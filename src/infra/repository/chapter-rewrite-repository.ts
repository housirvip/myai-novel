import type { ChapterRewrite } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type RewriteRow = {
  id: string
  book_id: string
  chapter_id: string
  source_draft_id: string
  source_review_id: string
  version_id: string
  strategy: ChapterRewrite['strategy']
  goals_json: string
  content: string
  actual_word_count: number
  created_at: string
}

export class ChapterRewriteRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(rewrite: ChapterRewrite): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_rewrites (
            id,
            book_id,
            chapter_id,
            source_draft_id,
            source_review_id,
            version_id,
            strategy,
            goals_json,
            content,
            actual_word_count,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        rewrite.id,
        rewrite.bookId,
        rewrite.chapterId,
        rewrite.sourceDraftId,
        rewrite.sourceReviewId,
        rewrite.versionId,
        rewrite.strategy,
        JSON.stringify(rewrite.goals),
        rewrite.content,
        rewrite.actualWordCount,
        rewrite.createdAt,
      )
  }

  getLatestByChapterId(chapterId: string): ChapterRewrite | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM chapter_rewrites
          WHERE chapter_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(chapterId) as RewriteRow | undefined

    return row ? mapRewrite(row) : null
  }

  listByChapterId(chapterId: string): ChapterRewrite[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM chapter_rewrites
          WHERE chapter_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(chapterId) as RewriteRow[]

    return rows.map(mapRewrite)
  }
}

function mapRewrite(row: RewriteRow): ChapterRewrite {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    sourceDraftId: row.source_draft_id,
    sourceReviewId: row.source_review_id,
    versionId: row.version_id,
    strategy: row.strategy,
    goals: JSON.parse(row.goals_json) as string[],
    content: row.content,
    actualWordCount: row.actual_word_count,
    createdAt: row.created_at,
  }
}
