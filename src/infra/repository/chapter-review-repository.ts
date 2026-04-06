import type { ReviewReport } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ReviewRow = {
  id: string
  book_id: string
  chapter_id: string
  draft_id: string
  decision: ReviewReport['decision']
  consistency_issues_json: string
  character_issues_json: string
  item_issues_json: string
  memory_issues_json: string
  pacing_issues_json: string
  hook_issues_json: string
  approval_risk: ReviewReport['approvalRisk']
  word_count_check_json: string
  new_fact_candidates_json: string
  closure_suggestions_json: string
  review_layers_json: string
  outcome_candidate_json: string
  revision_advice_json: string
  llm_metadata_json: string | null
  created_at: string
}

/**
 * `ChapterReviewRepository` 保存 review 阶段产出的诊断真源。
 *
 * review 不只是一个 decision 字段，
 * 它还承载了 closure suggestions、review layers、outcome candidate 等后续 rewrite / approve 会消费的结构化结果。
 */
export class ChapterReviewRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(review: ReviewReport): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_reviews (
          id,
          book_id,
          chapter_id,
          draft_id,
          decision,
          consistency_issues_json,
          character_issues_json,
          item_issues_json,
          memory_issues_json,
          pacing_issues_json,
          hook_issues_json,
          approval_risk,
          word_count_check_json,
          new_fact_candidates_json,
          closure_suggestions_json,
          review_layers_json,
          outcome_candidate_json,
          revision_advice_json,
          llm_metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      review.id,
      review.bookId,
      review.chapterId,
      review.draftId,
      review.decision,
      JSON.stringify(review.consistencyIssues),
      JSON.stringify(review.characterIssues),
      JSON.stringify(review.itemIssues),
      JSON.stringify(review.memoryIssues),
      JSON.stringify(review.pacingIssues),
      JSON.stringify(review.hookIssues),
      review.approvalRisk,
      JSON.stringify(review.wordCountCheck),
      JSON.stringify(review.newFactCandidates),
      JSON.stringify(review.closureSuggestions),
      JSON.stringify(review.reviewLayers),
      JSON.stringify(review.outcomeCandidate),
      JSON.stringify(review.revisionAdvice),
      review.llmMetadata ? JSON.stringify(review.llmMetadata) : null,
      review.createdAt,
    )
  }

  async createAsync(review: ReviewReport): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_reviews (
          id,
          book_id,
          chapter_id,
          draft_id,
          decision,
          consistency_issues_json,
          character_issues_json,
          item_issues_json,
          memory_issues_json,
          pacing_issues_json,
          hook_issues_json,
          approval_risk,
          word_count_check_json,
          new_fact_candidates_json,
          closure_suggestions_json,
          review_layers_json,
          outcome_candidate_json,
          revision_advice_json,
          llm_metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      review.id,
      review.bookId,
      review.chapterId,
      review.draftId,
      review.decision,
      JSON.stringify(review.consistencyIssues),
      JSON.stringify(review.characterIssues),
      JSON.stringify(review.itemIssues),
      JSON.stringify(review.memoryIssues),
      JSON.stringify(review.pacingIssues),
      JSON.stringify(review.hookIssues),
      review.approvalRisk,
      JSON.stringify(review.wordCountCheck),
      JSON.stringify(review.newFactCandidates),
      JSON.stringify(review.closureSuggestions),
      JSON.stringify(review.reviewLayers),
      JSON.stringify(review.outcomeCandidate),
      JSON.stringify(review.revisionAdvice),
      review.llmMetadata ? JSON.stringify(review.llmMetadata) : null,
      review.createdAt,
    )
  }

  getLatestByChapterId(chapterId: string): ReviewReport | null {
    const row = dbGet<ReviewRow>(
      this.database,
      `
        SELECT *
        FROM chapter_reviews
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapReview(row) : null
  }

  async getLatestByChapterIdAsync(chapterId: string): Promise<ReviewReport | null> {
    const row = await dbGetAsync<ReviewRow>(
      this.database,
      `
        SELECT *
        FROM chapter_reviews
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapReview(row) : null
  }

  getById(id: string): ReviewReport | null {
    const row = dbGet<ReviewRow>(this.database, 'SELECT * FROM chapter_reviews WHERE id = ?', id)

    return row ? mapReview(row) : null
  }

  async getByIdAsync(id: string): Promise<ReviewReport | null> {
    const row = await dbGetAsync<ReviewRow>(this.database, 'SELECT * FROM chapter_reviews WHERE id = ?', id)

    return row ? mapReview(row) : null
  }

  listByChapterId(chapterId: string): ReviewReport[] {
    const rows = dbAll<ReviewRow>(
      this.database,
      `
        SELECT *
        FROM chapter_reviews
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapReview)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ReviewReport[]> {
    const rows = await dbAllAsync<ReviewRow>(
      this.database,
      `
        SELECT *
        FROM chapter_reviews
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapReview)
  }
}

function mapReview(row: ReviewRow): ReviewReport {
  // 这里保留对旧 decision 值的归一化，避免历史数据把当前 review 链路冲断。
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    draftId: row.draft_id,
    decision: normalizeReviewDecision(row.decision),
    consistencyIssues: JSON.parse(row.consistency_issues_json) as string[],
    characterIssues: JSON.parse(row.character_issues_json) as string[],
    itemIssues: JSON.parse(row.item_issues_json) as string[],
    memoryIssues: JSON.parse(row.memory_issues_json) as string[],
    pacingIssues: JSON.parse(row.pacing_issues_json) as string[],
    hookIssues: JSON.parse(row.hook_issues_json) as string[],
    threadIssues: [],
    endingReadinessIssues: [],
    missionProgress: {
      status: 'not-applicable',
      evidence: [],
    },
    approvalRisk: row.approval_risk,
    wordCountCheck: JSON.parse(row.word_count_check_json) as ReviewReport['wordCountCheck'],
    newFactCandidates: JSON.parse(row.new_fact_candidates_json) as string[],
    closureSuggestions: JSON.parse(row.closure_suggestions_json) as ReviewReport['closureSuggestions'],
    reviewLayers: JSON.parse(row.review_layers_json) as ReviewReport['reviewLayers'],
    outcomeCandidate: JSON.parse(row.outcome_candidate_json) as ReviewReport['outcomeCandidate'],
    revisionAdvice: JSON.parse(row.revision_advice_json) as string[],
    llmMetadata: row.llm_metadata_json
      ? JSON.parse(row.llm_metadata_json) as NonNullable<ReviewReport['llmMetadata']>
      : undefined,
    createdAt: row.created_at,
  }
}

function normalizeReviewDecision(value: string): ReviewReport['decision'] {
  if (value === 'revise') {
    return 'needs-rewrite'
  }

  return value as ReviewReport['decision']
}
