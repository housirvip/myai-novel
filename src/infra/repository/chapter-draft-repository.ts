import type { ChapterDraft } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterDraftRow = {
  id: string
  book_id: string
  chapter_id: string
  version_id: string
  chapter_plan_id: string
  content: string
  actual_word_count: number
  llm_metadata_json: string | null
  created_at: string
}

export class ChapterDraftRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(draft: ChapterDraft): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_drafts (
          id,
          book_id,
          chapter_id,
          version_id,
          chapter_plan_id,
          content,
          actual_word_count,
          llm_metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      draft.id,
      draft.bookId,
      draft.chapterId,
      draft.versionId,
      draft.chapterPlanId,
      draft.content,
      draft.actualWordCount,
      draft.llmMetadata ? JSON.stringify(draft.llmMetadata) : null,
      draft.createdAt,
    )
  }

  async createAsync(draft: ChapterDraft): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_drafts (
          id,
          book_id,
          chapter_id,
          version_id,
          chapter_plan_id,
          content,
          actual_word_count,
          llm_metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      draft.id,
      draft.bookId,
      draft.chapterId,
      draft.versionId,
      draft.chapterPlanId,
      draft.content,
      draft.actualWordCount,
      draft.llmMetadata ? JSON.stringify(draft.llmMetadata) : null,
      draft.createdAt,
    )
  }

  getLatestByChapterId(chapterId: string): ChapterDraft | null {
    const row = dbGet<ChapterDraftRow>(
      this.database,
      `
        SELECT *
        FROM chapter_drafts
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapDraft(row) : null
  }

  async getLatestByChapterIdAsync(chapterId: string): Promise<ChapterDraft | null> {
    const row = await dbGetAsync<ChapterDraftRow>(
      this.database,
      `
        SELECT *
        FROM chapter_drafts
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapDraft(row) : null
  }

  getById(id: string): ChapterDraft | null {
    const row = dbGet<ChapterDraftRow>(this.database, 'SELECT * FROM chapter_drafts WHERE id = ?', id)

    return row ? mapDraft(row) : null
  }

  async getByIdAsync(id: string): Promise<ChapterDraft | null> {
    const row = await dbGetAsync<ChapterDraftRow>(this.database, 'SELECT * FROM chapter_drafts WHERE id = ?', id)

    return row ? mapDraft(row) : null
  }

  listByChapterId(chapterId: string): ChapterDraft[] {
    const rows = dbAll<ChapterDraftRow>(
      this.database,
      `
        SELECT *
        FROM chapter_drafts
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapDraft)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterDraft[]> {
    const rows = await dbAllAsync<ChapterDraftRow>(
      this.database,
      `
        SELECT *
        FROM chapter_drafts
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapDraft)
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
    llmMetadata: row.llm_metadata_json
      ? JSON.parse(row.llm_metadata_json) as NonNullable<ChapterDraft['llmMetadata']>
      : undefined,
    createdAt: row.created_at,
  }
}
