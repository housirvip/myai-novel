import type { NarrativeDebt } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

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

/**
 * `NarrativeDebtRepository` 保存章节确认后显式登记的叙事债务。
 *
 * 这类数据既不是“当前单值快照”，也不是随手可丢的日志：
 * 它们会跨章节持续存在，直到未来某章被明确 resolve。
 */
export class NarrativeDebtRepository {
  constructor(private readonly database: NovelDatabase) {}

  createBatch(debts: NarrativeDebt[]): void {
    const insertSql = `
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
    `

    // 当前保持逐条写入，优先换取可读性和跨后端一致性；
    // 这批数据量通常很小，不值得为批量 SQL 增加复杂度。
    for (const debt of debts) {
      dbRun(
        this.database,
        insertSql,
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

  async createBatchAsync(debts: NarrativeDebt[]): Promise<void> {
    const insertSql = `
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
    `

    for (const debt of debts) {
      await dbRunAsync(
        this.database,
        insertSql,
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
    // open debts 是 planning / review 最常消费的视图，因此提供专门查询入口。
    const rows = dbAll<NarrativeDebtRow>(
      this.database,
      "SELECT * FROM chapter_narrative_debts WHERE book_id = ? AND status = 'open' ORDER BY created_at DESC",
      bookId,
    )

    return rows.map(mapNarrativeDebt)
  }

  async listOpenByBookIdAsync(bookId: string): Promise<NarrativeDebt[]> {
    const rows = await dbAllAsync<NarrativeDebtRow>(
      this.database,
      "SELECT * FROM chapter_narrative_debts WHERE book_id = ? AND status = 'open' ORDER BY created_at DESC",
      bookId,
    )

    return rows.map(mapNarrativeDebt)
  }

  listByChapterId(chapterId: string): NarrativeDebt[] {
    const rows = dbAll<NarrativeDebtRow>(
      this.database,
      'SELECT * FROM chapter_narrative_debts WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapNarrativeDebt)
  }

  async listByChapterIdAsync(chapterId: string): Promise<NarrativeDebt[]> {
    const rows = await dbAllAsync<NarrativeDebtRow>(
      this.database,
      'SELECT * FROM chapter_narrative_debts WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapNarrativeDebt)
  }

  resolveByIds(ids: string[], resolvedAt: string): void {
    const updateSql = `
      UPDATE chapter_narrative_debts
      SET status = 'resolved',
          resolved_at = ?
      WHERE id = ?
    `

    // resolve 不删除历史记录，只切换状态并补 resolved_at，保留后续追溯能力。
    for (const id of ids) {
      dbRun(this.database, updateSql, resolvedAt, id)
    }
  }

  async resolveByIdsAsync(ids: string[], resolvedAt: string): Promise<void> {
    const updateSql = `
      UPDATE chapter_narrative_debts
      SET status = 'resolved',
          resolved_at = ?
      WHERE id = ?
    `

    for (const id of ids) {
      await dbRunAsync(this.database, updateSql, resolvedAt, id)
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
