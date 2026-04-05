import type { ChapterHookUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterHookUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  hook_id: string
  status: ChapterHookUpdate['status']
  summary: string
  detail_json: string
  created_at: string
}

export class ChapterHookUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterHookUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_hook_updates (
          id, book_id, chapter_id, hook_id, status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.hookId,
      update.status,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  async createAsync(update: ChapterHookUpdate): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_hook_updates (
          id, book_id, chapter_id, hook_id, status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.hookId,
      update.status,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterHookUpdate[] {
    const rows = dbAll<ChapterHookUpdateRow>(
      this.database,
      'SELECT * FROM chapter_hook_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterHookUpdate[]> {
    const rows = await dbAllAsync<ChapterHookUpdateRow>(
      this.database,
      'SELECT * FROM chapter_hook_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  listByBookId(bookId: string): ChapterHookUpdate[] {
    const rows = dbAll<ChapterHookUpdateRow>(
      this.database,
      'SELECT * FROM chapter_hook_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  async listByBookIdAsync(bookId: string): Promise<ChapterHookUpdate[]> {
    const rows = await dbAllAsync<ChapterHookUpdateRow>(
      this.database,
      'SELECT * FROM chapter_hook_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterHookUpdate)
  }
}

function mapChapterHookUpdate(row: ChapterHookUpdateRow): ChapterHookUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    hookId: row.hook_id,
    status: row.status,
    summary: row.summary,
    detail: JSON.parse(row.detail_json) as ChapterHookUpdate['detail'],
    createdAt: row.created_at,
  }
}
