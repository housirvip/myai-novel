import type { Faction } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbRun } from '../db/db-client.js'

export class FactionRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(faction: Faction): void {
    dbRun(
      this.database,
      `
        INSERT INTO factions (
          id, book_id, name, type, objective, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
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
