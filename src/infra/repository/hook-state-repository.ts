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

export class HookStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: HookCurrentState): void {
    dbRun(
      this.database,
      `
        INSERT INTO hook_current_state (book_id, hook_id, status, updated_by_chapter_id, updated_at)
        VALUES (?, ?, ?, ?, ?)
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
      'SELECT * FROM hook_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  async listByBookIdAsync(bookId: string): Promise<HookCurrentState[]> {
    const rows = await dbAllAsync<HookCurrentStateRow>(
      this.database,
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
        ORDER BY updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapHookCurrentState)
  }

  upsertBatch(states: HookCurrentState[]): void {
    const transaction = dbTransaction(this.database, (items: HookCurrentState[]) => {
      for (const item of items) {
        this.upsert(item)
      }
    })

    transaction(states)
  }

  async upsertBatchAsync(states: HookCurrentState[]): Promise<void> {
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
