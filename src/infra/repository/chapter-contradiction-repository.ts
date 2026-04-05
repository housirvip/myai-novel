import type { NarrativeContradiction } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbRun } from '../db/db-client.js'

type NarrativeContradictionRow = {
  id: string
  book_id: string
  chapter_id: string
  outcome_id: string
  source_review_id: string | null
  source_rewrite_id: string | null
  contradiction_type: NarrativeContradiction['contradictionType']
  summary: string
  severity: NarrativeContradiction['severity']
  status: NarrativeContradiction['status']
  created_at: string
  resolved_at: string | null
}

export class ChapterContradictionRepository {
  constructor(private readonly database: NovelDatabase) {}

  createBatch(contradictions: NarrativeContradiction[]): void {
    const sql = `
      INSERT INTO chapter_contradictions (
        id,
        book_id,
        chapter_id,
        outcome_id,
        source_review_id,
        source_rewrite_id,
        contradiction_type,
        summary,
        severity,
        status,
        created_at,
        resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    for (const contradiction of contradictions) {
      dbRun(
        this.database,
        sql,
        contradiction.id,
        contradiction.bookId,
        contradiction.chapterId,
        contradiction.outcomeId,
        contradiction.sourceReviewId ?? null,
        contradiction.sourceRewriteId ?? null,
        contradiction.contradictionType,
        contradiction.summary,
        contradiction.severity,
        contradiction.status,
        contradiction.createdAt,
        contradiction.resolvedAt ?? null,
      )
    }
  }

  listByChapterId(chapterId: string): NarrativeContradiction[] {
    const rows = dbAll<NarrativeContradictionRow>(
      this.database,
      'SELECT * FROM chapter_contradictions WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapNarrativeContradiction)
  }

  listOpenByBookId(bookId: string): NarrativeContradiction[] {
    const rows = dbAll<NarrativeContradictionRow>(
      this.database,
      "SELECT * FROM chapter_contradictions WHERE book_id = ? AND status = 'open' ORDER BY created_at DESC",
      bookId,
    )

    return rows.map(mapNarrativeContradiction)
  }
}

function mapNarrativeContradiction(row: NarrativeContradictionRow): NarrativeContradiction {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    outcomeId: row.outcome_id,
    sourceReviewId: row.source_review_id ?? undefined,
    sourceRewriteId: row.source_rewrite_id ?? undefined,
    contradictionType: row.contradiction_type,
    summary: row.summary,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}
