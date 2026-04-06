import type { Chapter, ChapterStatus } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

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

/**
 * `ChapterRepository` 管理章节主真源。
 *
 * 和 plan / draft / review / rewrite 这些过程产物 repository 不同，
 * chapter 表保存的是“当前这一章在主链里走到哪一步”以及“当前指向哪版计划 / 正文”的事实。
 */
export class ChapterRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(chapter: Chapter): void {
    dbRun(
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

  async createAsync(chapter: Chapter): Promise<void> {
    await dbRunAsync(
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
    const row = dbGet<{ maxIndex: number }>(
      this.database,
      'SELECT COALESCE(MAX(chapter_index), 0) AS maxIndex FROM chapters WHERE book_id = ?',
      bookId,
    ) as { maxIndex: number }

    return row.maxIndex + 1
  }

  async getNextIndexAsync(bookId: string): Promise<number> {
    const row = await dbGetAsync<{ maxIndex: number }>(
      this.database,
      'SELECT COALESCE(MAX(chapter_index), 0) AS maxIndex FROM chapters WHERE book_id = ?',
      bookId,
    ) as { maxIndex: number }

    return row.maxIndex + 1
  }

  getById(id: string): Chapter | null {
    const row = dbGet<ChapterRow>(this.database, 'SELECT * FROM chapters WHERE id = ?', id)

    return row ? mapChapter(row) : null
  }

  async getByIdAsync(id: string): Promise<Chapter | null> {
    const row = await dbGetAsync<ChapterRow>(this.database, 'SELECT * FROM chapters WHERE id = ?', id)

    return row ? mapChapter(row) : null
  }

  getPreviousChapter(bookId: string, index: number): Chapter | null {
    const row = dbGet<ChapterRow>(
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

  async getPreviousChapterAsync(bookId: string, index: number): Promise<Chapter | null> {
    const row = await dbGetAsync<ChapterRow>(
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
    // 章节只保存“当前采用哪版 plan”的指针；
    // 历史 plan 版本本身仍然由 ChapterPlanRepository 负责保存。
    dbRun(
      this.database,
      'UPDATE chapters SET current_plan_version_id = ?, updated_at = ? WHERE id = ?',
      versionId,
      updatedAt,
      chapterId,
    )
  }

  async updateCurrentPlanVersionAsync(chapterId: string, versionId: string, updatedAt: string): Promise<void> {
    await dbRunAsync(
      this.database,
      'UPDATE chapters SET current_plan_version_id = ?, updated_at = ? WHERE id = ?',
      versionId,
      updatedAt,
      chapterId,
    )
  }

  listByBookId(bookId: string): Chapter[] {
    const rows = dbAll<ChapterRow>(
      this.database,
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_index ASC',
      bookId,
    )

    return rows.map(mapChapter)
  }

  async listByBookIdAsync(bookId: string): Promise<Chapter[]> {
    const rows = await dbAllAsync<ChapterRow>(
      this.database,
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_index ASC',
      bookId,
    )

    return rows.map(mapChapter)
  }

  markDrafted(chapterId: string, currentVersionId: string, draftPath: string | undefined, updatedAt: string): void {
    // 进入 drafted 时会同步更新 current_version_id，
    // 因为后续 review / rewrite 都默认围绕当前正文版本工作。
    dbRun(
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

  async markDraftedAsync(
    chapterId: string,
    currentVersionId: string,
    draftPath: string | undefined,
    updatedAt: string,
  ): Promise<void> {
    await dbRunAsync(
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
    // review 阶段本身不会切换 current_version_id，
    // 它只是确认“当前正文版本已完成一次审查”。
    dbRun(
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

  async markReviewedAsync(chapterId: string, updatedAt: string): Promise<void> {
    await dbRunAsync(
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
    // current_version_id 可能指向 draft，也可能在 rewrite 后改指向 rewrite 版本。
    dbRun(
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

  async updateCurrentVersionAsync(chapterId: string, currentVersionId: string, updatedAt: string): Promise<void> {
    await dbRunAsync(
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
    // finalized 会把当前版本、最终文件路径、章节摘要和 approvedAt 一次性收口到 chapter 主真源。
    dbRun(
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

  async finalizeChapterAsync(
    chapterId: string,
    currentVersionId: string,
    finalPath: string,
    summary: string,
    approvedAt: string,
  ): Promise<void> {
    await dbRunAsync(
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
    dbRun(
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

  async updateWorkflowStateAsync(
    chapterId: string,
    input: UpdateChapterWorkflowStateInput,
    updatedAt: string,
  ): Promise<void> {
    await dbRunAsync(
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
  // repository 层负责把 planned beats 的 JSON 细节屏蔽掉，上层只看 Chapter 领域对象。
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
