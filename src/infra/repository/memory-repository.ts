import type { LongTermMemory, ShortTermMemory } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

export class MemoryRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsertShortTerm(memory: ShortTermMemory): void {
    this.database
      .prepare(
        `
          INSERT INTO short_term_memory_current (
            book_id, chapter_id, summaries_json, recent_events_json, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            chapter_id = excluded.chapter_id,
            summaries_json = excluded.summaries_json,
            recent_events_json = excluded.recent_events_json,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        memory.bookId,
        memory.chapterId,
        JSON.stringify(memory.summaries),
        JSON.stringify(memory.recentEvents),
        memory.updatedAt,
      )
  }

  upsertLongTerm(memory: LongTermMemory): void {
    this.database
      .prepare(
        `
          INSERT INTO long_term_memory_current (
            book_id, chapter_id, entries_json, updated_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            chapter_id = excluded.chapter_id,
            entries_json = excluded.entries_json,
            updated_at = excluded.updated_at
        `,
      )
      .run(memory.bookId, memory.chapterId, JSON.stringify(memory.entries), memory.updatedAt)
  }
}
