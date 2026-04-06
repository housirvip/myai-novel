import type { Location } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

// 地点仓储只负责静态地点设定；人物当前位置等运行态信息放在其他 current-state 表里。
export class LocationRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(location: Location): void {
    dbRun(
      this.database,
      `
        INSERT INTO locations (
          id, book_id, name, type, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      location.id,
      location.bookId,
      location.name,
      location.type,
      location.description,
      location.createdAt,
      location.updatedAt,
    )
  }

  async createAsync(location: Location): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO locations (
          id, book_id, name, type, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      location.id,
      location.bookId,
      location.name,
      location.type,
      location.description,
      location.createdAt,
      location.updatedAt,
    )
  }

  getById(locationId: string): Location | null {
    const row = dbGet<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(this.database, 'SELECT * FROM locations WHERE id = ?', locationId)

    return row
      ? {
          id: row.id,
          bookId: row.book_id,
          name: row.name,
          type: row.type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null
  }

  async getByIdAsync(locationId: string): Promise<Location | null> {
    const row = await dbGetAsync<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(this.database, 'SELECT * FROM locations WHERE id = ?', locationId)

    return row
      ? {
          id: row.id,
          bookId: row.book_id,
          name: row.name,
          type: row.type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null
  }

  listByBookId(bookId: string): Location[] {
    const rows = dbAll<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(
      this.database,
      // 地点列表按录入顺序返回，方便保持世界观展示的稳定性。
      'SELECT * FROM locations WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      name: row.name,
      type: row.type,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async listByBookIdAsync(bookId: string): Promise<Location[]> {
    const rows = await dbAllAsync<{
      id: string
      book_id: string
      name: string
      type: string
      description: string
      created_at: string
      updated_at: string
    }>(
      this.database,
      // 与同步版本保持一致，便于上下文构建时直接复用排序假设。
      'SELECT * FROM locations WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      name: row.name,
      type: row.type,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }
}
