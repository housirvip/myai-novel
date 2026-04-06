import type { CharacterCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type CharacterCurrentStateRow = {
  book_id: string
  character_id: string
  current_location_id: string | null
  status_notes_json: string
  updated_at: string
}

// `character_current_state` 是“当前快照”表，每个角色只保留一行最新状态，不保留逐章历史。
export class CharacterCurrentStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: CharacterCurrentState): void {
    dbRun(
      this.database,
      `
        INSERT INTO character_current_state (
          book_id,
          character_id,
          current_location_id,
          status_notes_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        -- 用复合主键覆盖旧值，让上层始终读取到角色的最新位置与状态备注。
        ON CONFLICT(book_id, character_id) DO UPDATE SET
          current_location_id = excluded.current_location_id,
          status_notes_json = excluded.status_notes_json,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.characterId,
      state.currentLocationId ?? null,
      JSON.stringify(state.statusNotes),
      state.updatedAt,
    )
  }

  async upsertAsync(state: CharacterCurrentState): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO character_current_state (
          book_id,
          character_id,
          current_location_id,
          status_notes_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        -- async 流程与同步流程共享同一份快照语义。
        ON CONFLICT(book_id, character_id) DO UPDATE SET
          current_location_id = excluded.current_location_id,
          status_notes_json = excluded.status_notes_json,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.characterId,
      state.currentLocationId ?? null,
      JSON.stringify(state.statusNotes),
      state.updatedAt,
    )
  }

  listByBookId(bookId: string): CharacterCurrentState[] {
    const rows = dbAll<CharacterCurrentStateRow>(
      this.database,
      // 最近更新的角色排在前面，便于状态面板优先关注刚发生变化的人物。
      'SELECT * FROM character_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapCharacterCurrentState)
  }

  async listByBookIdAsync(bookId: string): Promise<CharacterCurrentState[]> {
    const rows = await dbAllAsync<CharacterCurrentStateRow>(
      this.database,
      // 与同步接口保持同样的时间倒序，方便测试和输出对齐。
      'SELECT * FROM character_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapCharacterCurrentState)
  }

  getByCharacterId(bookId: string, characterId: string): CharacterCurrentState | null {
    const row = dbGet<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? AND character_id = ?',
      bookId,
      characterId,
    )

    return row ? mapCharacterCurrentState(row) : null
  }

  async getByCharacterIdAsync(bookId: string, characterId: string): Promise<CharacterCurrentState | null> {
    const row = await dbGetAsync<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? AND character_id = ?',
      bookId,
      characterId,
    )

    return row ? mapCharacterCurrentState(row) : null
  }
}

function mapCharacterCurrentState(row: CharacterCurrentStateRow): CharacterCurrentState {
  return {
    bookId: row.book_id,
    characterId: row.character_id,
    currentLocationId: row.current_location_id ?? undefined,
    // 以 JSON 数组落库，保持备注条目顺序，避免拆成子表后引入额外 join 成本。
    statusNotes: JSON.parse(row.status_notes_json) as string[],
    updatedAt: row.updated_at,
  }
}
