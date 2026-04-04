import type { StoryThreadProgress } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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

export class StoryThreadProgressRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(progress: StoryThreadProgress): void {
    this.database
      .prepare(
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
      )
      .run(
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
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM story_thread_progress
          WHERE thread_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(threadId) as StoryThreadProgressRow | undefined

    return row ? mapStoryThreadProgress(row) : null
  }

  listByBookId(bookId: string): StoryThreadProgress[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM story_thread_progress
          WHERE book_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(bookId) as StoryThreadProgressRow[]

    return rows.map(mapStoryThreadProgress)
  }

  listRecentByChapterWindow(bookId: string, startChapterId: string, endChapterId: string): StoryThreadProgress[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM story_thread_progress
          WHERE book_id = ?
            AND chapter_id IN (?, ?)
          ORDER BY created_at DESC
        `,
      )
      .all(bookId, startChapterId, endChapterId) as StoryThreadProgressRow[]

    return rows.map(mapStoryThreadProgress)
  }
}

function mapStoryThreadProgress(row: StoryThreadProgressRow): StoryThreadProgress {
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
