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
}
