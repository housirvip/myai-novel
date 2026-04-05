import type { CharacterArc } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type CharacterArcRow = {
  book_id: string
  character_id: string
  arc: string
  current_stage: CharacterArc['currentStage']
  updated_by_chapter_id: string | null
  summary: string
  updated_at: string
}

export class CharacterArcRepository {
  constructor(private readonly database: NovelDatabase) {}

  getByCharacterId(bookId: string, characterId: string): CharacterArc[] {
    const rows = dbAll<CharacterArcRow>(
      this.database,
      `
        SELECT *
        FROM character_arc_current_state
        WHERE book_id = ? AND character_id = ?
        ORDER BY updated_at DESC
      `,
      bookId,
      characterId,
    )

    return rows.map(mapCharacterArc)
  }

  async getByCharacterIdAsync(bookId: string, characterId: string): Promise<CharacterArc[]> {
    const rows = await dbAllAsync<CharacterArcRow>(
      this.database,
      `
        SELECT *
        FROM character_arc_current_state
        WHERE book_id = ? AND character_id = ?
        ORDER BY updated_at DESC
      `,
      bookId,
      characterId,
    )

    return rows.map(mapCharacterArc)
  }

  listByBookId(bookId: string): CharacterArc[] {
    const rows = dbAll<CharacterArcRow>(
      this.database,
      `
        SELECT *
        FROM character_arc_current_state
        WHERE book_id = ?
        ORDER BY updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapCharacterArc)
  }

  async listByBookIdAsync(bookId: string): Promise<CharacterArc[]> {
    const rows = await dbAllAsync<CharacterArcRow>(
      this.database,
      `
        SELECT *
        FROM character_arc_current_state
        WHERE book_id = ?
        ORDER BY updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapCharacterArc)
  }

  upsert(arc: CharacterArc): void {
    dbRun(
      this.database,
      `
        INSERT INTO character_arc_current_state (
          book_id,
          character_id,
          arc,
          current_stage,
          updated_by_chapter_id,
          summary,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, character_id, arc)
        DO UPDATE SET
          current_stage = excluded.current_stage,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          summary = excluded.summary,
          updated_at = excluded.updated_at
      `,
      arc.bookId,
      arc.characterId,
      arc.arc,
      arc.currentStage,
      arc.updatedByChapterId ?? null,
      arc.summary,
      arc.updatedAt,
    )
  }

  async upsertAsync(arc: CharacterArc): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO character_arc_current_state (
          book_id,
          character_id,
          arc,
          current_stage,
          updated_by_chapter_id,
          summary,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, character_id, arc)
        DO UPDATE SET
          current_stage = excluded.current_stage,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          summary = excluded.summary,
          updated_at = excluded.updated_at
      `,
      arc.bookId,
      arc.characterId,
      arc.arc,
      arc.currentStage,
      arc.updatedByChapterId ?? null,
      arc.summary,
      arc.updatedAt,
    )
  }
}

function mapCharacterArc(row: CharacterArcRow): CharacterArc {
  return {
    bookId: row.book_id,
    characterId: row.character_id,
    arc: row.arc,
    currentStage: row.current_stage,
    updatedByChapterId: row.updated_by_chapter_id ?? undefined,
    summary: row.summary,
    updatedAt: row.updated_at,
  }
}
