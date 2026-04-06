import type { ChapterMemoryUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterMemoryUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  memory_type: ChapterMemoryUpdate['memoryType']
  summary: string
  detail_json: string
  created_at: string
}

// `chapter_memory_updates` 记录逐章记忆变更建议/落地结果，属于章节级审计轨迹。
export class ChapterMemoryUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterMemoryUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_memory_updates (
          id, book_id, chapter_id, memory_type, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.memoryType,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  async createAsync(update: ChapterMemoryUpdate): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_memory_updates (
          id, book_id, chapter_id, memory_type, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.memoryType,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterMemoryUpdate[] {
    const rows = dbAll<ChapterMemoryUpdateRow>(
      this.database,
      // 单章查看时按创建顺序返回，方便还原该章里记忆补写的发生顺序。
      'SELECT * FROM chapter_memory_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterMemoryUpdate)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterMemoryUpdate[]> {
    const rows = await dbAllAsync<ChapterMemoryUpdateRow>(
      this.database,
      // async 版本保持同样排序，避免 trace 输出顺序漂移。
      'SELECT * FROM chapter_memory_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterMemoryUpdate)
  }

  listByBookId(bookId: string): ChapterMemoryUpdate[] {
    const rows = dbAll<ChapterMemoryUpdateRow>(
      this.database,
      // 整书回看时按时间倒序，便于最近更新优先显示。
      'SELECT * FROM chapter_memory_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterMemoryUpdate)
  }

  async listByBookIdAsync(bookId: string): Promise<ChapterMemoryUpdate[]> {
    const rows = await dbAllAsync<ChapterMemoryUpdateRow>(
      this.database,
      // 与同步版保持一致。
      'SELECT * FROM chapter_memory_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterMemoryUpdate)
  }
}

function mapChapterMemoryUpdate(row: ChapterMemoryUpdateRow): ChapterMemoryUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    memoryType: row.memory_type,
    summary: row.summary,
    // detail 统一走 JSON，兼容 short-term / observation / long-term 不同细节结构。
    detail: JSON.parse(row.detail_json) as ChapterMemoryUpdate['detail'],
    createdAt: row.created_at,
  }
}
