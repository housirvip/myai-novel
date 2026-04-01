import type { ChapterDraft } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterDraftRow = {
  id: string
  book_id: string
  chapter_id: string
  version_id: string
  chapter_plan_id: string
  content: string
  actual_word_count: number
  created_at: string
}

export class ChapterDraftRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(draft: ChapterDraft): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_drafts (
            id,
            book_id,
            chapter_id,
            version_id,
            chapter_plan_id,
            content,
            actual_word_count,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        draft.id,
        draft.bookId,
        draft.chapterId,
        draft.versionId,
        draft.chapterPlanId,
        draft.content,
        draft.actualWordCount,
        draft.createdAt,
      )
  }

  getLatestByChapterId(chapterId: string): ChapterDraft | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM chapter_drafts
          WHERE chapter_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(chapterId) as ChapterDraftRow | undefined

    return row ? mapDraft(row) : null
  }
}

function mapDraft(row: ChapterDraftRow): ChapterDraft {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    versionId: row.version_id,
    chapterPlanId: row.chapter_plan_id,
    content: row.content,
    actualWordCount: row.actual_word_count,
    createdAt: row.created_at,
  }
}
