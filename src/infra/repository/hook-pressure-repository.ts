import type { HookPressure } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbGet, dbRun } from '../db/db-client.js'

type HookPressureRow = {
  book_id: string
  hook_id: string
  pressure_score: number
  risk_level: HookPressure['riskLevel']
  last_advanced_chapter_id: string | null
  next_suggested_chapter_index: number | null
  updated_at: string
}

export class HookPressureRepository {
  constructor(private readonly database: NovelDatabase) {}

  getByHookId(bookId: string, hookId: string): HookPressure | null {
    const row = dbGet<HookPressureRow>(
      this.database,
      `
        SELECT *
        FROM hook_pressure_current
        WHERE book_id = ? AND hook_id = ?
        LIMIT 1
      `,
      bookId,
      hookId,
    )

    return row ? mapHookPressure(row) : null
  }

  listActiveByBookId(bookId: string): HookPressure[] {
    const rows = dbAll<HookPressureRow>(
      this.database,
      `
        SELECT *
        FROM hook_pressure_current
        WHERE book_id = ?
        ORDER BY pressure_score DESC, updated_at DESC
      `,
      bookId,
    )

    return rows.map(mapHookPressure)
  }

  upsert(pressure: HookPressure): void {
    dbRun(
      this.database,
      `
        INSERT INTO hook_pressure_current (
          book_id,
          hook_id,
          pressure_score,
          risk_level,
          last_advanced_chapter_id,
          next_suggested_chapter_index,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, hook_id)
        DO UPDATE SET
          pressure_score = excluded.pressure_score,
          risk_level = excluded.risk_level,
          last_advanced_chapter_id = excluded.last_advanced_chapter_id,
          next_suggested_chapter_index = excluded.next_suggested_chapter_index,
          updated_at = excluded.updated_at
      `,
      pressure.bookId,
      pressure.hookId,
      pressure.pressureScore,
      pressure.riskLevel,
      pressure.lastAdvancedChapterId ?? null,
      pressure.nextSuggestedChapterIndex ?? null,
      pressure.updatedAt,
    )
  }
}

function mapHookPressure(row: HookPressureRow): HookPressure {
  return {
    bookId: row.book_id,
    hookId: row.hook_id,
    pressureScore: row.pressure_score,
    riskLevel: row.risk_level,
    lastAdvancedChapterId: row.last_advanced_chapter_id ?? undefined,
    nextSuggestedChapterIndex: row.next_suggested_chapter_index ?? undefined,
    updatedAt: row.updated_at,
  }
}
