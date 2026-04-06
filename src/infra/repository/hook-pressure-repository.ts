import type { HookPressure } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type HookPressureRow = {
  book_id: string
  hook_id: string
  pressure_score: number
  risk_level: HookPressure['riskLevel']
  last_advanced_chapter_id: string | null
  next_suggested_chapter_index: number | null
  updated_at: string
}

/**
 * `HookPressureRepository` 保存 hook 当前的推进压力快照。
 *
 * 这张表回答的是：
 * - 哪些 hook 现在最该推进
 * - 风险等级如何
 * - 如果继续拖延，大致应该在第几章前处理
 */
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

  async getByHookIdAsync(bookId: string, hookId: string): Promise<HookPressure | null> {
    const row = await dbGetAsync<HookPressureRow>(
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
    // 这里不额外按 status 过滤，因为 hook pressure 本身就是 current 快照，默认只保留当前有效项。
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

  async listActiveByBookIdAsync(bookId: string): Promise<HookPressure[]> {
    const rows = await dbAllAsync<HookPressureRow>(
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
    // pressure 是按 (book_id, hook_id) 覆盖更新的 current-state 数据，而不是历史日志。
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

  async upsertAsync(pressure: HookPressure): Promise<void> {
    await dbRunAsync(
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
