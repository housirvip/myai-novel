import type { ChapterHookUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterHookUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  hook_id: string
  status: ChapterHookUpdate['status']
  summary: string
  detail_json: string
  created_at: string
}

// 章节伏笔更新表保留逐章记录，用来补足 `hook_current_state` 无法表达的历史明细。
export class ChapterHookUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterHookUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_hook_updates (
          id, book_id, chapter_id, hook_id, status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.hookId,
      update.status,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  async createAsync(update: ChapterHookUpdate): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_hook_updates (
          id, book_id, chapter_id, hook_id, status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.hookId,
      update.status,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterHookUpdate[] {
    const rows = dbAll<ChapterHookUpdateRow>(
      this.database,
      // 同章内按创建顺序返回，保留模型输出或人工确认时的原始先后关系。
      'SELECT * FROM chapter_hook_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterHookUpdate[]> {
    const rows = await dbAllAsync<ChapterHookUpdateRow>(
      this.database,
      // async 版本保持同样的章节内顺序。
      'SELECT * FROM chapter_hook_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  listByBookId(bookId: string): ChapterHookUpdate[] {
    const rows = dbAll<ChapterHookUpdateRow>(
      this.database,
      // 书级回看更关注最近发生的伏笔推进，因此按时间倒序。
      'SELECT * FROM chapter_hook_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterHookUpdate)
  }

  async listByBookIdAsync(bookId: string): Promise<ChapterHookUpdate[]> {
    const rows = await dbAllAsync<ChapterHookUpdateRow>(
      this.database,
      // 与同步版本一致，方便测试断言与 CLI 输出复用。
      'SELECT * FROM chapter_hook_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterHookUpdate)
  }
}

function mapChapterHookUpdate(row: ChapterHookUpdateRow): ChapterHookUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    hookId: row.hook_id,
    status: row.status,
    summary: row.summary,
    // 细节使用 JSON 保存，兼容不同状态更新携带的结构化补充字段。
    detail: JSON.parse(row.detail_json) as ChapterHookUpdate['detail'],
    createdAt: row.created_at,
  }
}
