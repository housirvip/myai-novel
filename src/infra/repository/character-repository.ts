import type { Character } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

export class CharacterRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(character: Character): void {
    this.database
      .prepare(
        `
          INSERT INTO characters (
            id, book_id, name, role, profile, motivation, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        character.id,
        character.bookId,
        character.name,
        character.role,
        character.profile,
        character.motivation,
        character.createdAt,
        character.updatedAt,
      )
  }
}
