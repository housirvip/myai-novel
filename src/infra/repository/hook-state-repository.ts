import type { HookCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

export class HookStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: HookCurrentState): void {
    this.database
      .prepare(
        `
          INSERT INTO hook_current_state (book_id, hook_id, status, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(book_id, hook_id) DO UPDATE SET
            status = excluded.status,
            updated_at = excluded.updated_at
        `,
      )
      .run(state.bookId, state.hookId, state.status, state.updatedAt)
  }
}
