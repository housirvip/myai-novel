import type { Location } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbGet, dbRun } from '../db/db-client.js'

export class LocationRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(location: Location): void {
    dbRun(
      this.database,
      `
        INSERT INTO locations (
          id, book_id, name, type, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
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
    const row = dbGet<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(this.database, 'SELECT * FROM locations WHERE id = ?', locationId)

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
    const rows = dbAll<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(this.database, 'SELECT * FROM locations WHERE book_id = ? ORDER BY created_at ASC', bookId)

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
