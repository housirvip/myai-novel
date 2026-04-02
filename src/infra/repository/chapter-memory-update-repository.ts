import type { ChapterMemoryUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterMemoryUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  memory_type: ChapterMemoryUpdate['memoryType']
  summary: string
  created_at: string
}

export class ChapterMemoryUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterMemoryUpdate): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_memory_updates (
            id, book_id, chapter_id, memory_type, summary, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(update.id, update.bookId, update.chapterId, update.memoryType, update.summary, update.createdAt)
  }

  listByChapterId(chapterId: string): ChapterMemoryUpdate[] {
    const rows = this.database
      .prepare('SELECT * FROM chapter_memory_updates WHERE chapter_id = ? ORDER BY created_at ASC')
      .all(chapterId) as ChapterMemoryUpdateRow[]

    return rows.map(mapChapterMemoryUpdate)
  }

  listByBookId(bookId: string): ChapterMemoryUpdate[] {
    const rows = this.database
      .prepare('SELECT * FROM chapter_memory_updates WHERE book_id = ? ORDER BY created_at DESC')
      .all(bookId) as ChapterMemoryUpdateRow[]

    return rows.map(mapChapterMemoryUpdate)
  }
}

function mapChapterMemoryUpdate(row: ChapterMemoryUpdateRow): ChapterMemoryUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    memoryType: row.memory_type,
    summary: row.summary,
    createdAt: row.created_at,
  }
}
