import type { Hook } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

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

// `hooks` 记录伏笔定义本身；后续状态推进由 `hook_current_state` 和章节更新表补充。
export class HookRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(hook: Hook): void {
    dbRun(
      this.database,
      `
        INSERT INTO hooks (
          id, book_id, title, source_chapter_id, description, payoff_expectation, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
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

  async createAsync(hook: Hook): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO hooks (
          id, book_id, title, source_chapter_id, description, payoff_expectation, priority, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
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
    // 伏笔列表按首次埋设顺序返回，更符合读者视角下的时间线。
    const rows = dbAll<HookRow>(this.database, 'SELECT * FROM hooks WHERE book_id = ? ORDER BY created_at ASC', bookId)

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

  async listByBookIdAsync(bookId: string): Promise<Hook[]> {
    const rows = await dbAllAsync<HookRow>(
      this.database,
      // async 接口保留同样排序，避免计划与状态输出出现顺序抖动。
      'SELECT * FROM hooks WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

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
