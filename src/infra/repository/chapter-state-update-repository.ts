import type { ChapterStateUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterStateUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  entity_type: ChapterStateUpdate['entityType']
  entity_id: string
  summary: string
  detail_json: string
  created_at: string
}

export class ChapterStateUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterStateUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_state_updates (
          id, book_id, chapter_id, entity_type, entity_id, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.entityType,
      update.entityId,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  async createAsync(update: ChapterStateUpdate): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_state_updates (
          id, book_id, chapter_id, entity_type, entity_id, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.entityType,
      update.entityId,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterStateUpdate[] {
    const rows = dbAll<ChapterStateUpdateRow>(
      this.database,
      'SELECT * FROM chapter_state_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterStateUpdate[]> {
    const rows = await dbAllAsync<ChapterStateUpdateRow>(
      this.database,
      'SELECT * FROM chapter_state_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  listByBookId(bookId: string): ChapterStateUpdate[] {
    const rows = dbAll<ChapterStateUpdateRow>(
      this.database,
      'SELECT * FROM chapter_state_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  async listByBookIdAsync(bookId: string): Promise<ChapterStateUpdate[]> {
    const rows = await dbAllAsync<ChapterStateUpdateRow>(
      this.database,
      'SELECT * FROM chapter_state_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterStateUpdate)
  }
}

function mapChapterStateUpdate(row: ChapterStateUpdateRow): ChapterStateUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    detail: JSON.parse(row.detail_json) as ChapterStateUpdate['detail'],
    createdAt: row.created_at,
  }
}
