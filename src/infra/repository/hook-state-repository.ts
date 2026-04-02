import type { HookCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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
    this.database
      .prepare(
        `
          INSERT INTO hook_current_state (book_id, hook_id, status, updated_by_chapter_id, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(book_id, hook_id) DO UPDATE SET
            status = excluded.status,
            updated_by_chapter_id = excluded.updated_by_chapter_id,
            updated_at = excluded.updated_at
        `,
      )
      .run(state.bookId, state.hookId, state.status, state.updatedByChapterId ?? null, state.updatedAt)
  }

  listByBookId(bookId: string): HookCurrentState[] {
    const rows = this.database
      .prepare('SELECT * FROM hook_current_state WHERE book_id = ? ORDER BY updated_at DESC')
      .all(bookId) as HookCurrentStateRow[]

    return rows.map(mapHookCurrentState)
  }

  listActiveByBookId(bookId: string): HookCurrentState[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM hook_current_state
          WHERE book_id = ? AND status != 'resolved'
          ORDER BY updated_at DESC
        `,
      )
      .all(bookId) as HookCurrentStateRow[]

    return rows.map(mapHookCurrentState)
  }

  upsertBatch(states: HookCurrentState[]): void {
    const transaction = this.database.transaction((items: HookCurrentState[]) => {
      for (const item of items) {
        this.upsert(item)
      }
    })

    transaction(states)
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
