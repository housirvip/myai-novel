import type { NovelDatabase } from '../db/database.js'
import type { StoryState } from '../../shared/types/domain.js'

type StoryStateRow = {
  book_id: string
  current_chapter_id: string
  recent_events_json: string
  updated_at: string
}

export class StoryStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: StoryState): void {
    this.database
      .prepare(
        `
          INSERT INTO story_current_state (
            book_id,
            current_chapter_id,
            recent_events_json,
            updated_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            current_chapter_id = excluded.current_chapter_id,
            recent_events_json = excluded.recent_events_json,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        state.bookId,
        state.currentChapterId,
        JSON.stringify(state.recentEvents),
        state.updatedAt,
      )
  }

  getByBookId(bookId: string): StoryState | null {
    const row = this.database.prepare('SELECT * FROM story_current_state WHERE book_id = ?').get(bookId) as
      | StoryStateRow
      | undefined

    if (!row) {
      return null
    }

    return {
      bookId: row.book_id,
      currentChapterId: row.current_chapter_id,
      recentEvents: JSON.parse(row.recent_events_json) as string[],
      updatedAt: row.updated_at,
    }
  }
}
