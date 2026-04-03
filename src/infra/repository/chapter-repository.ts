import type { Chapter, ChapterStatus } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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
      )
      .run(
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
    const row = this.database
      .prepare('SELECT COALESCE(MAX(chapter_index), 0) AS maxIndex FROM chapters WHERE book_id = ?')
      .get(bookId) as { maxIndex: number }

    return row.maxIndex + 1
  }

  getById(id: string): Chapter | null {
    const row = this.database.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as
      | ChapterRow
      | undefined

    return row ? mapChapter(row) : null
  }

  getPreviousChapter(bookId: string, index: number): Chapter | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM chapters
          WHERE book_id = ? AND chapter_index < ?
          ORDER BY chapter_index DESC
          LIMIT 1
        `,
      )
      .get(bookId, index) as ChapterRow | undefined

    return row ? mapChapter(row) : null
  }

  updateCurrentPlanVersion(chapterId: string, versionId: string, updatedAt: string): void {
    this.database
      .prepare('UPDATE chapters SET current_plan_version_id = ?, updated_at = ? WHERE id = ?')
      .run(versionId, updatedAt, chapterId)
  }

  listByBookId(bookId: string): Chapter[] {
    const rows = this.database
      .prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_index ASC')
      .all(bookId) as ChapterRow[]

    return rows.map(mapChapter)
  }

  markDrafted(chapterId: string, currentVersionId: string, draftPath: string | undefined, updatedAt: string): void {
    this.database
      .prepare(
        `
          UPDATE chapters
          SET status = 'drafted',
              current_version_id = ?,
              draft_path = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(currentVersionId, draftPath ?? null, updatedAt, chapterId)
  }

  markReviewed(chapterId: string, updatedAt: string): void {
    this.database
      .prepare(
        `
          UPDATE chapters
          SET status = 'reviewed',
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(updatedAt, chapterId)
  }

  updateCurrentVersion(chapterId: string, currentVersionId: string, updatedAt: string): void {
    this.database
      .prepare(
        `
          UPDATE chapters
          SET current_version_id = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(currentVersionId, updatedAt, chapterId)
  }

  finalizeChapter(
    chapterId: string,
    currentVersionId: string,
    finalPath: string,
    summary: string,
    approvedAt: string,
  ): void {
    this.database
      .prepare(
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
      )
      .run(currentVersionId, finalPath, summary, approvedAt, approvedAt, chapterId)
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
