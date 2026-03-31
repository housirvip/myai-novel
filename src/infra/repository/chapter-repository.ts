import type { Chapter, ChapterStatus } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterRow = {
  id: string
  book_id: string
  volume_id: string
  chapter_index: number
  title: string
  objective: string
  planned_beats_json: string
  status: ChapterStatus
  current_plan_version_id: string | null
  current_version_id: string | null
  draft_path: string | null
  final_path: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export class ChapterRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(chapter: Chapter): void {
    this.database
      .prepare(
        `
          INSERT INTO chapters (
            id,
            book_id,
            volume_id,
            chapter_index,
            title,
            objective,
            planned_beats_json,
            status,
            current_plan_version_id,
            current_version_id,
            draft_path,
            final_path,
            approved_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        chapter.id,
        chapter.bookId,
        chapter.volumeId,
        chapter.index,
        chapter.title,
        chapter.objective,
        JSON.stringify(chapter.plannedBeats),
        chapter.status,
        chapter.currentPlanVersionId ?? null,
        chapter.currentVersionId ?? null,
        chapter.draftPath ?? null,
        chapter.finalPath ?? null,
        chapter.approvedAt ?? null,
        chapter.createdAt,
        chapter.updatedAt,
      )
  }

  getNextIndex(bookId: string): number {
    const row = this.database
      .prepare('SELECT COALESCE(MAX(chapter_index), 0) AS maxIndex FROM chapters WHERE book_id = ?')
      .get(bookId) as { maxIndex: number }

    return row.maxIndex + 1
  }
}
