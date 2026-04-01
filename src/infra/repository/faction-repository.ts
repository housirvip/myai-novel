import type { Faction } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

export class FactionRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(faction: Faction): void {
    this.database
      .prepare(
        `
          INSERT INTO factions (
            id, book_id, name, type, objective, description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        faction.id,
        faction.bookId,
        faction.name,
        faction.type,
        faction.objective,
        faction.description,
        faction.createdAt,
        faction.updatedAt,
      )
  }
}
