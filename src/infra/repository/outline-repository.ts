import type { NovelDatabase } from '../db/database.js'
import type { Outline } from '../../shared/types/domain.js'
import { dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type OutlineRow = {
  book_id: string
  premise: string
  theme: string
  worldview: string
  core_conflicts_json: string
  ending_vision: string
  updated_at: string
}

export class OutlineRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsert(outline: Outline): void {
    dbRun(
      this.database,
      `
        INSERT INTO outlines (
          book_id,
          premise,
          theme,
          worldview,
          core_conflicts_json,
          ending_vision,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          premise = excluded.premise,
          theme = excluded.theme,
          worldview = excluded.worldview,
          core_conflicts_json = excluded.core_conflicts_json,
          ending_vision = excluded.ending_vision,
          updated_at = excluded.updated_at
      `,
      outline.bookId,
      outline.premise,
      outline.theme,
      outline.worldview,
      JSON.stringify(outline.coreConflicts),
      outline.endingVision,
      outline.updatedAt,
    )
  }

  async upsertAsync(outline: Outline): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO outlines (
          book_id,
          premise,
          theme,
          worldview,
          core_conflicts_json,
          ending_vision,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          premise = excluded.premise,
          theme = excluded.theme,
          worldview = excluded.worldview,
          core_conflicts_json = excluded.core_conflicts_json,
          ending_vision = excluded.ending_vision,
          updated_at = excluded.updated_at
      `,
      outline.bookId,
      outline.premise,
      outline.theme,
      outline.worldview,
      JSON.stringify(outline.coreConflicts),
      outline.endingVision,
      outline.updatedAt,
    )
  }

  getByBookId(bookId: string): Outline | null {
    const row = dbGet<OutlineRow>(this.database, 'SELECT * FROM outlines WHERE book_id = ?', bookId)

    if (!row) {
      return null
    }

    return {
      bookId: row.book_id,
      premise: row.premise,
      theme: row.theme,
      worldview: row.worldview,
      coreConflicts: JSON.parse(row.core_conflicts_json) as string[],
      endingVision: row.ending_vision,
      updatedAt: row.updated_at,
    }
  }

  async getByBookIdAsync(bookId: string): Promise<Outline | null> {
    const row = await dbGetAsync<OutlineRow>(this.database, 'SELECT * FROM outlines WHERE book_id = ?', bookId)

    if (!row) {
      return null
    }

    return {
      bookId: row.book_id,
      premise: row.premise,
      theme: row.theme,
      worldview: row.worldview,
      coreConflicts: JSON.parse(row.core_conflicts_json) as string[],
      endingVision: row.ending_vision,
      updatedAt: row.updated_at,
    }
  }
}
