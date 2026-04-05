import type { CharacterCurrentState } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type CharacterCurrentStateRow = {
  book_id: string
  character_id: string
  current_location_id: string | null
  status_notes_json: string
  updated_at: string
}

export class CharacterCurrentStateRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(state: CharacterCurrentState): void {
    dbRun(
      this.database,
      `
        INSERT INTO character_current_state (
          book_id,
          character_id,
          current_location_id,
          status_notes_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(book_id, character_id) DO UPDATE SET
          current_location_id = excluded.current_location_id,
          status_notes_json = excluded.status_notes_json,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.characterId,
      state.currentLocationId ?? null,
      JSON.stringify(state.statusNotes),
      state.updatedAt,
    )
  }

  async upsertAsync(state: CharacterCurrentState): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO character_current_state (
          book_id,
          character_id,
          current_location_id,
          status_notes_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(book_id, character_id) DO UPDATE SET
          current_location_id = excluded.current_location_id,
          status_notes_json = excluded.status_notes_json,
          updated_at = excluded.updated_at
      `,
      state.bookId,
      state.characterId,
      state.currentLocationId ?? null,
      JSON.stringify(state.statusNotes),
      state.updatedAt,
    )
  }

  listByBookId(bookId: string): CharacterCurrentState[] {
    const rows = dbAll<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapCharacterCurrentState)
  }

  async listByBookIdAsync(bookId: string): Promise<CharacterCurrentState[]> {
    const rows = await dbAllAsync<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? ORDER BY updated_at DESC',
      bookId,
    )

    return rows.map(mapCharacterCurrentState)
  }

  getByCharacterId(bookId: string, characterId: string): CharacterCurrentState | null {
    const row = dbGet<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? AND character_id = ?',
      bookId,
      characterId,
    )

    return row ? mapCharacterCurrentState(row) : null
  }

  async getByCharacterIdAsync(bookId: string, characterId: string): Promise<CharacterCurrentState | null> {
    const row = await dbGetAsync<CharacterCurrentStateRow>(
      this.database,
      'SELECT * FROM character_current_state WHERE book_id = ? AND character_id = ?',
      bookId,
      characterId,
    )

    return row ? mapCharacterCurrentState(row) : null
  }
}

function mapCharacterCurrentState(row: CharacterCurrentStateRow): CharacterCurrentState {
  return {
    bookId: row.book_id,
    characterId: row.character_id,
    currentLocationId: row.current_location_id ?? undefined,
    statusNotes: JSON.parse(row.status_notes_json) as string[],
    updatedAt: row.updated_at,
  }
}
