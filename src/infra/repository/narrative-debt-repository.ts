import type { NarrativeDebt } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { sqliteAll, sqlitePrepare } from '../db/sqlite-client.js'

type NarrativeDebtRow = {
  id: string
  book_id: string
  chapter_id: string
  outcome_id: string
  source_review_id: string | null
  source_rewrite_id: string | null
  debt_type: NarrativeDebt['debtType']
  summary: string
  priority: NarrativeDebt['priority']
  status: NarrativeDebt['status']
  created_at: string
  resolved_at: string | null
}

export class NarrativeDebtRepository {
  constructor(private readonly database: NovelDatabase) {}

  createBatch(debts: NarrativeDebt[]): void {
    const statement = sqlitePrepare(
      this.database,
      `
        INSERT INTO chapter_narrative_debts (
          id,
          book_id,
          chapter_id,
          outcome_id,
          source_review_id,
          source_rewrite_id,
          debt_type,
          summary,
          priority,
          status,
          created_at,
          resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )

    for (const debt of debts) {
      statement.run(
        debt.id,
        debt.bookId,
        debt.chapterId,
        debt.outcomeId,
        debt.sourceReviewId ?? null,
        debt.sourceRewriteId ?? null,
        debt.debtType,
        debt.summary,
        debt.priority,
        debt.status,
        debt.createdAt,
        debt.resolvedAt ?? null,
      )
    }
  }

  listOpenByBookId(bookId: string): NarrativeDebt[] {
    const rows = sqliteAll<NarrativeDebtRow>(
      this.database,
      "SELECT * FROM chapter_narrative_debts WHERE book_id = ? AND status = 'open' ORDER BY created_at DESC",
      bookId,
    )

    return rows.map(mapNarrativeDebt)
  }

  listByChapterId(chapterId: string): NarrativeDebt[] {
    const rows = sqliteAll<NarrativeDebtRow>(
      this.database,
      'SELECT * FROM chapter_narrative_debts WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapNarrativeDebt)
  }

  resolveByIds(ids: string[], resolvedAt: string): void {
    const statement = sqlitePrepare(
      this.database,
      `
        UPDATE chapter_narrative_debts
        SET status = 'resolved',
            resolved_at = ?
        WHERE id = ?
      `,
    )

    for (const id of ids) {
      statement.run(resolvedAt, id)
    }
  }
}

function mapNarrativeDebt(row: NarrativeDebtRow): NarrativeDebt {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    outcomeId: row.outcome_id,
    sourceReviewId: row.source_review_id ?? undefined,
    sourceRewriteId: row.source_rewrite_id ?? undefined,
    debtType: row.debt_type,
    summary: row.summary,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}
