import type { ChapterOutput } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterOutputRow = {
  id: string
  book_id: string
  chapter_id: string
  source_type: ChapterOutput['sourceType']
  source_id: string
  final_path: string
  content: string
  created_at: string
}

export class ChapterOutputRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(output: ChapterOutput): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_outputs (
            id,
            book_id,
            chapter_id,
            source_type,
            source_id,
            final_path,
            content,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        output.id,
        output.bookId,
        output.chapterId,
        output.sourceType,
        output.sourceId,
        output.finalPath,
        output.content,
        output.createdAt,
      )
  }

  getLatestByChapterId(chapterId: string): ChapterOutput | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM chapter_outputs
          WHERE chapter_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(chapterId) as ChapterOutputRow | undefined

    if (!row) {
      return null
    }

    return {
      id: row.id,
      bookId: row.book_id,
      chapterId: row.chapter_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      finalPath: row.final_path,
      content: row.content,
      createdAt: row.created_at,
    }
  }
}
