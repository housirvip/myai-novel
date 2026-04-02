import type { LongTermMemory, ShortTermMemory } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ShortTermMemoryRow = {
  book_id: string
  chapter_id: string
  summaries_json: string
  recent_events_json: string
  updated_at: string
}

type LongTermMemoryRow = {
  book_id: string
  chapter_id: string
  entries_json: string
  updated_at: string
}

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

  getShortTermByBookId(bookId: string): ShortTermMemory | null {
    const row = this.database
      .prepare('SELECT * FROM short_term_memory_current WHERE book_id = ?')
      .get(bookId) as ShortTermMemoryRow | undefined

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          summaries: JSON.parse(row.summaries_json) as string[],
          recentEvents: JSON.parse(row.recent_events_json) as string[],
          updatedAt: row.updated_at,
        }
      : null
  }

  getLongTermByBookId(bookId: string): LongTermMemory | null {
    const row = this.database
      .prepare('SELECT * FROM long_term_memory_current WHERE book_id = ?')
      .get(bookId) as LongTermMemoryRow | undefined

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          entries: JSON.parse(row.entries_json) as LongTermMemory['entries'],
          updatedAt: row.updated_at,
        }
      : null
  }

  recallRelevantLongTermEntries(bookId: string, queryTerms: string[], maxEntries = 5): LongTermMemory['entries'] {
    const memory = this.getLongTermByBookId(bookId)

    if (!memory) {
      return []
    }

    const normalizedTerms = queryTerms
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length > 0)

    return [...memory.entries]
      .map((entry) => ({
        entry,
        score:
          entry.importance * 10 +
          normalizedTerms.reduce((count, term) => count + (entry.summary.toLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, maxEntries)
      .map((item) => item.entry)
  }
}
