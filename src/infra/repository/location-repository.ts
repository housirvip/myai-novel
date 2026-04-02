import type { Location } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

export class LocationRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(location: Location): void {
    this.database
      .prepare(
        `
          INSERT INTO locations (
            id, book_id, name, type, description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        location.id,
        location.bookId,
        location.name,
        location.type,
        location.description,
        location.createdAt,
        location.updatedAt,
      )
  }

  getById(locationId: string): Location | null {
    const row = this.database.prepare('SELECT * FROM locations WHERE id = ?').get(locationId) as
      | {
          id: string
          book_id: string
          name: string
          type: string
          description: string
          created_at: string
          updated_at: string
        }
      | undefined

    return row
      ? {
          id: row.id,
          bookId: row.book_id,
          name: row.name,
          type: row.type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null
  }

  listByBookId(bookId: string): Location[] {
    const rows = this.database
      .prepare('SELECT * FROM locations WHERE book_id = ? ORDER BY created_at ASC')
      .all(bookId) as Array<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      name: row.name,
      type: row.type,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }
}
