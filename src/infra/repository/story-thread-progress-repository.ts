import type { StoryThreadProgress } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type StoryThreadProgressRow = {
  id: string
  book_id: string
  thread_id: string
  chapter_id: string
  progress_status: StoryThreadProgress['progressStatus']
  summary: string
  detail_json: string
  created_at: string
}

/**
 * `StoryThreadProgressRepository` 保存线程推进的章节级轨迹。
 *
 * 它不是 current-state 表，而是 append-only 的 progress log：
 * 每次章节确认后新增一条或多条记录，供 doctor / state / volume review 回看“线程是怎么被推进或搁置的”。
 */
export class StoryThreadProgressRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(progress: StoryThreadProgress): void {
    dbRun(
      this.database,
      `
        INSERT INTO story_thread_progress (
          id,
          book_id,
          thread_id,
          chapter_id,
          progress_status,
          summary,
          detail_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      progress.id,
      progress.bookId,
      progress.threadId,
      progress.chapterId,
      progress.progressStatus,
      progress.summary,
      JSON.stringify(progress.impacts),
      progress.createdAt,
    )
  }

  async createAsync(progress: StoryThreadProgress): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO story_thread_progress (
          id,
          book_id,
          thread_id,
          chapter_id,
          progress_status,
          summary,
          detail_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      progress.id,
      progress.bookId,
      progress.threadId,
      progress.chapterId,
      progress.progressStatus,
      progress.summary,
      JSON.stringify(progress.impacts),
      progress.createdAt,
    )
  }

  getLatestByThreadId(threadId: string): StoryThreadProgress | null {
    const row = dbGet<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE thread_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      threadId,
    )

    return row ? mapStoryThreadProgress(row) : null
  }

  async getLatestByThreadIdAsync(threadId: string): Promise<StoryThreadProgress | null> {
    const row = await dbGetAsync<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE thread_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      threadId,
    )

    return row ? mapStoryThreadProgress(row) : null
  }

  listByBookId(bookId: string): StoryThreadProgress[] {
    const rows = dbAll<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE book_id = ?
        ORDER BY created_at DESC
      `,
      bookId,
    )

    return rows.map(mapStoryThreadProgress)
  }

  async listByBookIdAsync(bookId: string): Promise<StoryThreadProgress[]> {
    const rows = await dbAllAsync<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE book_id = ?
        ORDER BY created_at DESC
      `,
      bookId,
    )

    return rows.map(mapStoryThreadProgress)
  }

  listRecentByChapterWindow(bookId: string, startChapterId: string, endChapterId: string): StoryThreadProgress[] {
    // 当前窗口查询只做最小 chapter 范围抽样，主要给 volume / thread 视图快速展示最近推进痕迹。
    const rows = dbAll<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE book_id = ?
          AND chapter_id IN (?, ?)
        ORDER BY created_at DESC
      `,
      bookId,
      startChapterId,
      endChapterId,
    )

    return rows.map(mapStoryThreadProgress)
  }

  async listRecentByChapterWindowAsync(
    bookId: string,
    startChapterId: string,
    endChapterId: string,
  ): Promise<StoryThreadProgress[]> {
    const rows = await dbAllAsync<StoryThreadProgressRow>(
      this.database,
      `
        SELECT *
        FROM story_thread_progress
        WHERE book_id = ?
          AND chapter_id IN (?, ?)
        ORDER BY created_at DESC
      `,
      bookId,
      startChapterId,
      endChapterId,
    )

    return rows.map(mapStoryThreadProgress)
  }
}

function mapStoryThreadProgress(row: StoryThreadProgressRow): StoryThreadProgress {
  // impacts 以 JSON 落盘，是因为线程推进影响通常是结构化数组，单列文本不够表达。
  return {
    id: row.id,
    bookId: row.book_id,
    threadId: row.thread_id,
    chapterId: row.chapter_id,
    progressStatus: row.progress_status,
    summary: row.summary,
    impacts: JSON.parse(row.detail_json) as StoryThreadProgress['impacts'],
    createdAt: row.created_at,
  }
}
