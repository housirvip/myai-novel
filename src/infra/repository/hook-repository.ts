import type { Hook } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type HookRow = {
  id: string
  book_id: string
  title: string
  source_chapter_id: string | null
  description: string
  payoff_expectation: string
  priority: Hook['priority']
  status: Hook['status']
  created_at: string
  updated_at: string
}

export class HookRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(hook: Hook): void {
    this.database
      .prepare(
        `
          INSERT INTO hooks (
            id, book_id, title, source_chapter_id, description, payoff_expectation, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        hook.id,
        hook.bookId,
        hook.title,
        hook.sourceChapterId ?? null,
        hook.description,
        hook.payoffExpectation,
        hook.priority,
        hook.status,
        hook.createdAt,
        hook.updatedAt,
      )
  }

  listByBookId(bookId: string): Hook[] {
    const rows = this.database.prepare('SELECT * FROM hooks WHERE book_id = ? ORDER BY created_at ASC').all(bookId) as HookRow[]

    return rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      title: row.title,
      sourceChapterId: row.source_chapter_id ?? undefined,
      description: row.description,
      payoffExpectation: row.payoff_expectation,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }
}
