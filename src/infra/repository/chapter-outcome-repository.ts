import type { ChapterOutcome } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { sqliteAll, sqliteGet, sqliteRun } from '../db/sqlite-client.js'

type ChapterOutcomeRow = {
  id: string
  book_id: string
  chapter_id: string
  source_review_id: string | null
  source_rewrite_id: string | null
  decision: ChapterOutcome['decision']
  resolved_facts_json: string
  observation_facts_json: string
  character_arc_progress_json: string
  hook_debt_updates_json: string
  created_at: string
}

export class ChapterOutcomeRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(outcome: ChapterOutcome): void {
    sqliteRun(
      this.database,
      `
        INSERT INTO chapter_outcomes (
          id,
          book_id,
          chapter_id,
          source_review_id,
          source_rewrite_id,
          decision,
          resolved_facts_json,
          observation_facts_json,
          character_arc_progress_json,
          hook_debt_updates_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      outcome.id,
      outcome.bookId,
      outcome.chapterId,
      outcome.sourceReviewId ?? null,
      outcome.sourceRewriteId ?? null,
      outcome.decision,
      JSON.stringify(outcome.resolvedFacts),
      JSON.stringify(outcome.observationFacts),
      JSON.stringify(outcome.characterArcProgress),
      JSON.stringify(outcome.hookDebtUpdates),
      outcome.createdAt,
    )
  }

  getLatestByChapterId(chapterId: string): ChapterOutcome | null {
    const row = sqliteGet<ChapterOutcomeRow>(
      this.database,
      `
        SELECT *
        FROM chapter_outcomes
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapChapterOutcome(row) : null
  }

  listByChapterId(chapterId: string): ChapterOutcome[] {
    const rows = sqliteAll<ChapterOutcomeRow>(
      this.database,
      `
        SELECT *
        FROM chapter_outcomes
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapChapterOutcome)
  }
}

function mapChapterOutcome(row: ChapterOutcomeRow): ChapterOutcome {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    sourceReviewId: row.source_review_id ?? undefined,
    sourceRewriteId: row.source_rewrite_id ?? undefined,
    decision: row.decision,
    resolvedFacts: JSON.parse(row.resolved_facts_json) as ChapterOutcome['resolvedFacts'],
    observationFacts: JSON.parse(row.observation_facts_json) as ChapterOutcome['observationFacts'],
    contradictions: [],
    narrativeDebts: [],
    characterArcProgress: JSON.parse(row.character_arc_progress_json) as ChapterOutcome['characterArcProgress'],
    hookDebtUpdates: JSON.parse(row.hook_debt_updates_json) as ChapterOutcome['hookDebtUpdates'],
    createdAt: row.created_at,
  }
}
