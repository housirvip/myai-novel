import type { NovelDatabase } from '../db/database.js'
import type { Volume } from '../../shared/types/domain.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type VolumeRow = {
  id: string
  book_id: string
  title: string
  goal: string
  summary: string
  chapter_ids_json: string
  created_at: string
  updated_at: string
}

/**
 * `VolumeRepository` 保存卷级基础真源。
 *
 * 它和 `VolumePlanRepository` 的区别是：
 * - 这里记录卷的静态定义与章节归属
 * - volume plan 记录卷的动态导演与滚动窗口规划
 */
export class VolumeRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(volume: Volume): void {
    dbRun(
      this.database,
      `
        INSERT INTO volumes (
          id,
          book_id,
          title,
          goal,
          summary,
          chapter_ids_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      volume.id,
      volume.bookId,
      volume.title,
      volume.goal,
      volume.summary,
      JSON.stringify(volume.chapterIds),
      volume.createdAt,
      volume.updatedAt,
    )
  }

  async createAsync(volume: Volume): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO volumes (
          id,
          book_id,
          title,
          goal,
          summary,
          chapter_ids_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      volume.id,
      volume.bookId,
      volume.title,
      volume.goal,
      volume.summary,
      JSON.stringify(volume.chapterIds),
      volume.createdAt,
      volume.updatedAt,
    )
  }

  getById(id: string): Volume | null {
    const row = dbGet<VolumeRow>(this.database, 'SELECT * FROM volumes WHERE id = ?', id)

    return row ? mapVolume(row) : null
  }

  async getByIdAsync(id: string): Promise<Volume | null> {
    const row = await dbGetAsync<VolumeRow>(this.database, 'SELECT * FROM volumes WHERE id = ?', id)

    return row ? mapVolume(row) : null
  }

  getByChapterId(chapterId: string): Volume | null {
    const row = dbGet<VolumeRow>(
      this.database,
      `
        SELECT v.*
        FROM volumes v
        INNER JOIN chapters c ON c.volume_id = v.id
        WHERE c.id = ?
      `,
      chapterId,
    )

    return row ? mapVolume(row) : null
  }

  async getByChapterIdAsync(chapterId: string): Promise<Volume | null> {
    const row = await dbGetAsync<VolumeRow>(
      this.database,
      `
        SELECT v.*
        FROM volumes v
        INNER JOIN chapters c ON c.volume_id = v.id
        WHERE c.id = ?
      `,
      chapterId,
    )

    return row ? mapVolume(row) : null
  }

  updateChapterIds(id: string, chapterIds: string[], updatedAt: string): void {
    // chapterIds 是卷与章节排序关系的持久化来源之一，新增/删除章节后需要同步维护。
    dbRun(
      this.database,
      'UPDATE volumes SET chapter_ids_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(chapterIds),
      updatedAt,
      id,
    )
  }

  async updateChapterIdsAsync(id: string, chapterIds: string[], updatedAt: string): Promise<void> {
    await dbRunAsync(
      this.database,
      'UPDATE volumes SET chapter_ids_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(chapterIds),
      updatedAt,
      id,
    )
  }

  listByBookId(bookId: string): Volume[] {
    const rows = dbAll<VolumeRow>(
      this.database,
      'SELECT * FROM volumes WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map(mapVolume)
  }

  async listByBookIdAsync(bookId: string): Promise<Volume[]> {
    const rows = await dbAllAsync<VolumeRow>(
      this.database,
      'SELECT * FROM volumes WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map(mapVolume)
  }
}

function mapVolume(row: VolumeRow): Volume {
  // repository 层负责还原卷内章节顺序，避免上层重复关心 JSON 细节。
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    goal: row.goal,
    summary: row.summary,
    chapterIds: JSON.parse(row.chapter_ids_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
