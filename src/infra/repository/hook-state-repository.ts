import type { HookCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync, dbTransaction, dbTransactionAsync } from '../db/db-client.js'

type HookCurrentStateRow = {
  book_id: string
  hook_id: string
  status: HookCurrentState['status']
  updated_by_chapter_id: string | null
  updated_at: string
}

// `hook_current_state` 是伏笔状态投影表，强调“现在进行到哪”，不是逐章审计日志。
export class HookStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: HookCurrentState): void {
    dbRun(
      this.database,
      `
        INSERT INTO hook_current_state (book_id, hook_id, status, updated_by_chapter_id, updated_at)
        VALUES (?, ?, ?, ?, ?)
        -- 同一伏笔只保留最新状态，章节粒度的变化细节交给 chapter_hook_updates。
        ON CONFLICT(book_id, hook_id) DO UPDATE SET
          status = excluded.status,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.hookId,
      state.status,
      state.updatedByChapterId ?? null,
      state.updatedAt,
    )
  }

  async upsertAsync(state: HookCurrentState): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO hook_current_state (book_id, hook_id, status, updated_by_chapter_id, updated_at)
        VALUES (?, ?, ?, ?, ?)
        -- async 版本沿用相同的快照写入语义。
        ON CONFLICT(book_id, hook_id) DO UPDATE SET
          status = excluded.status,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.hookId,
      state.status,
      state.updatedByChapterId ?? null,
      state.updatedAt,
    )
  }

  listByBookId(bookId: string): HookCurrentState[] {
    const rows = dbAll<HookCurrentStateRow>(
      this.database,
      // 最近有推进或结算的伏笔排在前面，便于面板优先显示关键变化。
      'SELECT * FROM hook_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  async listByBookIdAsync(bookId: string): Promise<HookCurrentState[]> {
    const rows = await dbAllAsync<HookCurrentStateRow>(
      this.database,
      // 与同步接口保持同序。
      'SELECT * FROM hook_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  listActiveByBookId(bookId: string): HookCurrentState[] {
    const rows = dbAll<HookCurrentStateRow>(
      this.database,
      `
        SELECT *
        FROM hook_current_state
        WHERE book_id = ? AND status != 'resolved'
        -- “活动中”定义为未 resolved，方便计划阶段聚焦仍需兑现的伏笔。
        ORDER BY updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  async listActiveByBookIdAsync(bookId: string): Promise<HookCurrentState[]> {
    const rows = await dbAllAsync<HookCurrentStateRow>(
      this.database,
      `
        SELECT *
        FROM hook_current_state
        WHERE book_id = ? AND status != 'resolved'
        -- async 版本同样只过滤掉已回收的伏笔。
        ORDER BY updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  upsertBatch(states: HookCurrentState[]): void {
    // 批量写入复用仓储自身的 upsert，确保单条与批量路径的约束完全一致。
    const transaction = dbTransaction(this.database, (items: HookCurrentState[]) => {
      for (const item of items) {
        this.upsert(item)
      }
    })

    transaction(states)
  }

  async upsertBatchAsync(states: HookCurrentState[]): Promise<void> {
    // async 事务主要用于审阅/改写后一口气刷新多条伏笔状态，避免部分成功。
    const transaction = dbTransactionAsync(this.database, async (items: HookCurrentState[]) => {
      for (const item of items) {
        await this.upsertAsync(item)
      }
    })

    await transaction(states)
  }
}

function mapHookCurrentState(row: HookCurrentStateRow): HookCurrentState {
  return {
    bookId: row.book_id,
    hookId: row.hook_id,
    status: row.status,
    updatedByChapterId: row.updated_by_chapter_id ?? undefined,
    updatedAt: row.updated_at,
  }
}
