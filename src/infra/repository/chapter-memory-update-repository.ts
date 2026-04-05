import type { ChapterMemoryUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbRun } from '../db/db-client.js'

type ChapterMemoryUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  memory_type: ChapterMemoryUpdate['memoryType']
  summary: string
  detail_json: string
  created_at: string
}

export class ChapterMemoryUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterMemoryUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_memory_updates (
          id, book_id, chapter_id, memory_type, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.memoryType,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterMemoryUpdate[] {
    const rows = dbAll<ChapterMemoryUpdateRow>(
      this.database,
      'SELECT * FROM chapter_memory_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterMemoryUpdate)
  }

  listByBookId(bookId: string): ChapterMemoryUpdate[] {
    const rows = dbAll<ChapterMemoryUpdateRow>(
      this.database,
      'SELECT * FROM chapter_memory_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

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
    detail: JSON.parse(row.detail_json) as ChapterMemoryUpdate['detail'],
    createdAt: row.created_at,
  }
}
