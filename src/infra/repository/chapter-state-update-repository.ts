import type { ChapterStateUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterStateUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  entity_type: ChapterStateUpdate['entityType']
  entity_id: string
  summary: string
  created_at: string
}

export class ChapterStateUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterStateUpdate): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_state_updates (
            id, book_id, chapter_id, entity_type, entity_id, summary, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(update.id, update.bookId, update.chapterId, update.entityType, update.entityId, update.summary, update.createdAt)
  }

  listByChapterId(chapterId: string): ChapterStateUpdate[] {
    const rows = this.database
      .prepare('SELECT * FROM chapter_state_updates WHERE chapter_id = ? ORDER BY created_at ASC')
      .all(chapterId) as ChapterStateUpdateRow[]

    return rows.map(mapChapterStateUpdate)
  }

  listByBookId(bookId: string): ChapterStateUpdate[] {
    const rows = this.database
      .prepare('SELECT * FROM chapter_state_updates WHERE book_id = ? ORDER BY created_at DESC')
      .all(bookId) as ChapterStateUpdateRow[]

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
    createdAt: row.created_at,
  }
}
