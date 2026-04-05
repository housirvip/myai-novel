import type { EndingReadiness } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type EndingReadinessRow = {
  book_id: string
  target_volume_id: string
  readiness_score: number
  closure_score: number
  pending_payoffs_json: string
  closure_gaps_json: string
  final_conflict_prerequisites_json: string
  updated_at: string
}

export class EndingReadinessRepository {
  constructor(private readonly database: NovelDatabase) {}

  getByBookId(bookId: string): EndingReadiness | null {
    const row = dbGet<EndingReadinessRow>(
      this.database,
      `
        SELECT *
        FROM ending_readiness_current
        WHERE book_id = ?
        LIMIT 1
      `,
      bookId,
    )

    return row ? mapEndingReadiness(row) : null
  }

  async getByBookIdAsync(bookId: string): Promise<EndingReadiness | null> {
    const row = await dbGetAsync<EndingReadinessRow>(
      this.database,
      `
        SELECT *
        FROM ending_readiness_current
        WHERE book_id = ?
        LIMIT 1
      `,
      bookId,
    )

    return row ? mapEndingReadiness(row) : null
  }

  upsert(readiness: EndingReadiness): void {
    dbRun(
      this.database,
      `
        INSERT INTO ending_readiness_current (
          book_id,
          target_volume_id,
          readiness_score,
          closure_score,
          pending_payoffs_json,
          closure_gaps_json,
          final_conflict_prerequisites_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id)
        DO UPDATE SET
          target_volume_id = excluded.target_volume_id,
          readiness_score = excluded.readiness_score,
          closure_score = excluded.closure_score,
          pending_payoffs_json = excluded.pending_payoffs_json,
          closure_gaps_json = excluded.closure_gaps_json,
          final_conflict_prerequisites_json = excluded.final_conflict_prerequisites_json,
          updated_at = excluded.updated_at
      `,
      readiness.bookId,
      readiness.targetVolumeId,
      readiness.readinessScore,
      readiness.closureScore,
      JSON.stringify(readiness.pendingPayoffs),
      JSON.stringify(readiness.closureGaps),
      JSON.stringify(readiness.finalConflictPrerequisites),
      readiness.updatedAt,
    )
  }

  async upsertAsync(readiness: EndingReadiness): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO ending_readiness_current (
          book_id,
          target_volume_id,
          readiness_score,
          closure_score,
          pending_payoffs_json,
          closure_gaps_json,
          final_conflict_prerequisites_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id)
        DO UPDATE SET
          target_volume_id = excluded.target_volume_id,
          readiness_score = excluded.readiness_score,
          closure_score = excluded.closure_score,
          pending_payoffs_json = excluded.pending_payoffs_json,
          closure_gaps_json = excluded.closure_gaps_json,
          final_conflict_prerequisites_json = excluded.final_conflict_prerequisites_json,
          updated_at = excluded.updated_at
      `,
      readiness.bookId,
      readiness.targetVolumeId,
      readiness.readinessScore,
      readiness.closureScore,
      JSON.stringify(readiness.pendingPayoffs),
      JSON.stringify(readiness.closureGaps),
      JSON.stringify(readiness.finalConflictPrerequisites),
      readiness.updatedAt,
    )
  }
}

function mapEndingReadiness(row: EndingReadinessRow): EndingReadiness {
  return {
    bookId: row.book_id,
    targetVolumeId: row.target_volume_id,
    readinessScore: row.readiness_score,
    closureScore: row.closure_score,
    pendingPayoffs: JSON.parse(row.pending_payoffs_json) as EndingReadiness['pendingPayoffs'],
    closureGaps: JSON.parse(row.closure_gaps_json) as EndingReadiness['closureGaps'],
    finalConflictPrerequisites: JSON.parse(row.final_conflict_prerequisites_json) as EndingReadiness['finalConflictPrerequisites'],
    updatedAt: row.updated_at,
  }
}
