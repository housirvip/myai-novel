import type { ContextItemView, ItemCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ItemCurrentStateRow = {
  book_id: string
  item_id: string
  owner_character_id: string | null
  location_id: string | null
  quantity: number
  status: string
  updated_at: string
}

type ImportantItemRow = {
  id: string
  book_id: string
  name: string
  unit: string
  type: string
  description: string
  is_unique_worldwide: number
  is_important: number
  owner_character_id: string | null
  location_id: string | null
  quantity: number | null
  status: string | null
  updated_at: string | null
}

// `item_current_state` 维护物品的最新归属/位置/数量，供上下文与状态命令直接消费。
export class ItemCurrentStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: ItemCurrentState): void {
    dbRun(
      this.database,
      `
        INSERT INTO item_current_state (
          book_id,
          item_id,
          owner_character_id,
          location_id,
          quantity,
          status,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        -- 每个物品只保留一条当前记录；章节级历史若需要追溯，应看输出或审查结果表。
        ON CONFLICT(book_id, item_id) DO UPDATE SET
          owner_character_id = excluded.owner_character_id,
          location_id = excluded.location_id,
          quantity = excluded.quantity,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.itemId,
      state.ownerCharacterId ?? null,
      state.locationId ?? null,
      state.quantity,
      state.status,
      state.updatedAt,
    )
  }

  async upsertAsync(state: ItemCurrentState): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO item_current_state (
          book_id,
          item_id,
          owner_character_id,
          location_id,
          quantity,
          status,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        -- async 写入遵循同样的最新快照覆盖逻辑。
        ON CONFLICT(book_id, item_id) DO UPDATE SET
          owner_character_id = excluded.owner_character_id,
          location_id = excluded.location_id,
          quantity = excluded.quantity,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.itemId,
      state.ownerCharacterId ?? null,
      state.locationId ?? null,
      state.quantity,
      state.status,
      state.updatedAt,
    )
  }

  getByItemId(bookId: string, itemId: string): ItemCurrentState | null {
    const row = dbGet<ItemCurrentStateRow>(
      this.database,
      'SELECT * FROM item_current_state WHERE book_id = ? AND item_id = ?',
      bookId,
      itemId,
    )

    return row ? mapItemCurrentState(row) : null
  }

  async getByItemIdAsync(bookId: string, itemId: string): Promise<ItemCurrentState | null> {
    const row = await dbGetAsync<ItemCurrentStateRow>(
      this.database,
      'SELECT * FROM item_current_state WHERE book_id = ? AND item_id = ?',
      bookId,
      itemId,
    )

    return row ? mapItemCurrentState(row) : null
  }

  listImportantByBookId(bookId: string): ContextItemView[] {
    const rows = dbAll<ImportantItemRow>(
      this.database,
      `
        SELECT
          items.id,
          items.book_id,
          items.name,
          items.unit,
          items.type,
          items.description,
          items.is_unique_worldwide,
          items.is_important,
          item_current_state.owner_character_id,
          item_current_state.location_id,
          item_current_state.quantity,
          item_current_state.status,
          item_current_state.updated_at
        FROM items
        LEFT JOIN item_current_state
          ON items.book_id = item_current_state.book_id
         AND items.id = item_current_state.item_id
        WHERE items.book_id = ?
          AND items.is_important = 1
        -- 先按物品定义顺序遍历，再拼接状态，避免状态更新时间影响核心设定展示顺序。
        ORDER BY items.created_at ASC
      `,
      bookId,
    )

    return rows.map(mapContextItemView)
  }

  async listImportantByBookIdAsync(bookId: string): Promise<ContextItemView[]> {
    const rows = await dbAllAsync<ImportantItemRow>(
      this.database,
      `
        SELECT
          items.id,
          items.book_id,
          items.name,
          items.unit,
          items.type,
          items.description,
          items.is_unique_worldwide,
          items.is_important,
          item_current_state.owner_character_id,
          item_current_state.location_id,
          item_current_state.quantity,
          item_current_state.status,
          item_current_state.updated_at
        FROM items
        LEFT JOIN item_current_state
          ON items.book_id = item_current_state.book_id
         AND items.id = item_current_state.item_id
        WHERE items.book_id = ?
          AND items.is_important = 1
        -- 与同步接口一致，保证上下文构建在 sync/async 模式下可比对。
        ORDER BY items.created_at ASC
      `,
      bookId,
    )

    return rows.map(mapContextItemView)
  }
}

function mapItemCurrentState(row: ItemCurrentStateRow): ItemCurrentState {
  return {
    bookId: row.book_id,
    itemId: row.item_id,
    ownerCharacterId: row.owner_character_id ?? undefined,
    locationId: row.location_id ?? undefined,
    quantity: row.quantity,
    status: row.status,
    updatedAt: row.updated_at,
  }
}

function mapContextItemView(row: ImportantItemRow): ContextItemView {
  return {
    id: row.id,
    bookId: row.book_id,
    itemId: row.id,
    name: row.name,
    unit: row.unit,
    type: row.type,
    description: row.description,
    isUniqueWorldwide: row.is_unique_worldwide === 1,
    isImportant: row.is_important === 1,
    ownerCharacterId: row.owner_character_id ?? undefined,
    locationId: row.location_id ?? undefined,
    // 尚未写入 current-state 的重要物品，按“单件、未记录”兜底，避免上下文里直接缺失。
    quantity: row.quantity ?? 1,
    status: row.status ?? '未记录',
    updatedAt: row.updated_at ?? '',
  }
}
