import type { Chapter, ChapterStatus } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { sqliteAll, sqliteGet, sqliteRun } from '../db/sqlite-client.js'

type ChapterRow = {
  id: string
  book_id: string
  volume_id: string
  chapter_index: number
  title: string
  objective: string
  summary: string | null
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

type UpdateChapterWorkflowStateInput = {
  status: ChapterStatus
  currentPlanVersionId?: string | null
  currentVersionId?: string | null
  draftPath?: string | null
  finalPath?: string | null
  approvedAt?: string | null
  summary?: string | null
}
 
export class ChapterRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(chapter: Chapter): void {
    sqliteRun(
      this.database,
      `
        INSERT INTO chapters (
          id,
          book_id,
          volume_id,
          chapter_index,
          title,
          objective,
          summary,
          planned_beats_json,
          status,
          current_plan_version_id,
          current_version_id,
          draft_path,
          final_path,
          approved_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      chapter.id,
      chapter.bookId,
      chapter.volumeId,
      chapter.index,
      chapter.title,
      chapter.objective,
      chapter.summary ?? null,
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
    const row = sqliteGet<{ maxIndex: number }>(
      this.database,
      'SELECT COALESCE(MAX(chapter_index), 0) AS maxIndex FROM chapters WHERE book_id = ?',
      bookId,
    ) as { maxIndex: number }

    return row.maxIndex + 1
  }

  getById(id: string): Chapter | null {
    const row = sqliteGet<ChapterRow>(this.database, 'SELECT * FROM chapters WHERE id = ?', id)

    return row ? mapChapter(row) : null
  }

  getPreviousChapter(bookId: string, index: number): Chapter | null {
    const row = sqliteGet<ChapterRow>(
      this.database,
      `
        SELECT *
        FROM chapters
        WHERE book_id = ? AND chapter_index < ?
        ORDER BY chapter_index DESC
        LIMIT 1
      `,
      bookId,
      index,
    )

    return row ? mapChapter(row) : null
  }

  updateCurrentPlanVersion(chapterId: string, versionId: string, updatedAt: string): void {
    sqliteRun(
      this.database,
      'UPDATE chapters SET current_plan_version_id = ?, updated_at = ? WHERE id = ?',
      versionId,
      updatedAt,
      chapterId,
    )
  }

  listByBookId(bookId: string): Chapter[] {
    const rows = sqliteAll<ChapterRow>(
      this.database,
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_index ASC',
      bookId,
    )

    return rows.map(mapChapter)
  }

  markDrafted(chapterId: string, currentVersionId: string, draftPath: string | undefined, updatedAt: string): void {
    sqliteRun(
      this.database,
      `
        UPDATE chapters
        SET status = 'drafted',
            current_version_id = ?,
            draft_path = ?,
            updated_at = ?
        WHERE id = ?
      `,
      currentVersionId,
      draftPath ?? null,
      updatedAt,
      chapterId,
    )
  }

  markReviewed(chapterId: string, updatedAt: string): void {
    sqliteRun(
      this.database,
      `
        UPDATE chapters
        SET status = 'reviewed',
            updated_at = ?
        WHERE id = ?
      `,
      updatedAt,
      chapterId,
    )
  }

  updateCurrentVersion(chapterId: string, currentVersionId: string, updatedAt: string): void {
    sqliteRun(
      this.database,
      `
        UPDATE chapters
        SET current_version_id = ?,
            updated_at = ?
        WHERE id = ?
      `,
      currentVersionId,
      updatedAt,
      chapterId,
    )
  }

  finalizeChapter(
    chapterId: string,
    currentVersionId: string,
    finalPath: string,
    summary: string,
    approvedAt: string,
  ): void {
    sqliteRun(
      this.database,
      `
        UPDATE chapters
        SET status = 'finalized',
            current_version_id = ?,
            final_path = ?,
            summary = ?,
            approved_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      currentVersionId,
      finalPath,
      summary,
      approvedAt,
      approvedAt,
      chapterId,
    )
  }

  updateWorkflowState(chapterId: string, input: UpdateChapterWorkflowStateInput, updatedAt: string): void {
    sqliteRun(
      this.database,
      `
        UPDATE chapters
        SET status = ?,
            current_plan_version_id = ?,
            current_version_id = ?,
            draft_path = ?,
            final_path = ?,
            summary = ?,
            approved_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      input.status,
      input.currentPlanVersionId ?? null,
      input.currentVersionId ?? null,
      input.draftPath ?? null,
      input.finalPath ?? null,
      input.summary ?? null,
      input.approvedAt ?? null,
      updatedAt,
      chapterId,
    )
  }
}

function mapChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    bookId: row.book_id,
    volumeId: row.volume_id,
    index: row.chapter_index,
    title: row.title,
    objective: row.objective,
    summary: row.summary ?? undefined,
    plannedBeats: JSON.parse(row.planned_beats_json) as string[],
    status: row.status,
    currentPlanVersionId: row.current_plan_version_id ?? undefined,
    currentVersionId: row.current_version_id ?? undefined,
    draftPath: row.draft_path ?? undefined,
    finalPath: row.final_path ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
