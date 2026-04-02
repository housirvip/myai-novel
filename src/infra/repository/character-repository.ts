import type { Character } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type CharacterRow = {
  id: string
  book_id: string
  name: string
  role: string
  profile: string
  motivation: string
  created_at: string
  updated_at: string
}

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

  getById(characterId: string): Character | null {
    const row = this.database.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as CharacterRow | undefined

    return row ? mapCharacter(row) : null
  }

  listByBookId(bookId: string): Character[] {
    const rows = this.database
      .prepare('SELECT * FROM characters WHERE book_id = ? ORDER BY created_at ASC')
      .all(bookId) as CharacterRow[]

    return rows.map(mapCharacter)
  }

  getPrimaryByBookId(bookId: string): Character | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM characters
          WHERE book_id = ?
          ORDER BY CASE WHEN role = '主角' THEN 0 ELSE 1 END, created_at ASC
          LIMIT 1
        `,
      )
      .get(bookId) as CharacterRow | undefined

    return row ? mapCharacter(row) : null
  }
}

function mapCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    bookId: row.book_id,
    name: row.name,
    role: row.role,
    profile: row.profile,
    motivation: row.motivation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
