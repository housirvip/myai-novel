import type { ChapterStateUpdate } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterStateUpdateRow = {
  id: string
  book_id: string
  chapter_id: string
  entity_type: ChapterStateUpdate['entityType']
  entity_id: string
  summary: string
  detail_json: string
  created_at: string
}

// `chapter_state_updates` 保存逐章状态变更痕迹，是 append-only 历史表，不承担 current-state 投影职责。
export class ChapterStateUpdateRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(update: ChapterStateUpdate): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_state_updates (
          id, book_id, chapter_id, entity_type, entity_id, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.entityType,
      update.entityId,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  async createAsync(update: ChapterStateUpdate): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_state_updates (
          id, book_id, chapter_id, entity_type, entity_id, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      update.id,
      update.bookId,
      update.chapterId,
      update.entityType,
      update.entityId,
      update.summary,
      JSON.stringify(update.detail),
      update.createdAt,
    )
  }

  listByChapterId(chapterId: string): ChapterStateUpdate[] {
    const rows = dbAll<ChapterStateUpdateRow>(
      this.database,
      // 章内查看保留原始生成顺序，方便回放某一章里状态更新的先后。
      'SELECT * FROM chapter_state_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterStateUpdate[]> {
    const rows = await dbAllAsync<ChapterStateUpdateRow>(
      this.database,
      // async 版本与同步版保持同样的时间正序。
      'SELECT * FROM chapter_state_updates WHERE chapter_id = ? ORDER BY created_at ASC',
      chapterId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  listByBookId(bookId: string): ChapterStateUpdate[] {
    const rows = dbAll<ChapterStateUpdateRow>(
      this.database,
      // 整书视角更关注最近变化，因此改为倒序返回。
      'SELECT * FROM chapter_state_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterStateUpdate)
  }

  async listByBookIdAsync(bookId: string): Promise<ChapterStateUpdate[]> {
    const rows = await dbAllAsync<ChapterStateUpdateRow>(
      this.database,
      // 与同步接口保持一致，便于 state 面板直接截取最近 N 条。
      'SELECT * FROM chapter_state_updates WHERE book_id = ? ORDER BY created_at DESC',
      bookId,
    )

    return rows.map(mapChapterStateUpdate)
  }
}

function mapChapterStateUpdate(row: ChapterStateUpdateRow): ChapterStateUpdate {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    // detail 以 JSON 保存，兼容不同实体类型共用一张更新历史表。
    detail: JSON.parse(row.detail_json) as ChapterStateUpdate['detail'],
    createdAt: row.created_at,
  }
}
