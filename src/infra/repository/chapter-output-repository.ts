import type { ChapterOutput } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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
}
