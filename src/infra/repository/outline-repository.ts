import type { NovelDatabase } from '../db/database.js'
import type { Outline } from '../../shared/types/domain.js'

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
    this.database
      .prepare(
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
      )
      .run(
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
    const row = this.database.prepare('SELECT * FROM outlines WHERE book_id = ?').get(bookId) as
      | OutlineRow
      | undefined

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
