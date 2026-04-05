import type { Item } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ItemRow = {
  id: string
  book_id: string
  name: string
  unit: string
  type: string
  is_unique_worldwide: number
  is_important: number
  description: string
  created_at: string
  updated_at: string
}

export class ItemRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(item: Item): void {
    dbRun(
      this.database,
      `
        INSERT INTO items (
          id,
          book_id,
          name,
          unit,
          type,
          is_unique_worldwide,
          is_important,
          description,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      item.id,
      item.bookId,
      item.name,
      item.unit,
      item.type,
      item.isUniqueWorldwide ? 1 : 0,
      item.isImportant ? 1 : 0,
      item.description,
      item.createdAt,
      item.updatedAt,
    )
  }

  async createAsync(item: Item): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO items (
          id,
          book_id,
          name,
          unit,
          type,
          is_unique_worldwide,
          is_important,
          description,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      item.id,
      item.bookId,
      item.name,
      item.unit,
      item.type,
      item.isUniqueWorldwide ? 1 : 0,
      item.isImportant ? 1 : 0,
      item.description,
      item.createdAt,
      item.updatedAt,
    )
  }

  getById(itemId: string): Item | null {
    const row = dbGet<ItemRow>(this.database, 'SELECT * FROM items WHERE id = ?', itemId)

    return row ? mapItem(row) : null
  }

  async getByIdAsync(itemId: string): Promise<Item | null> {
    const row = await dbGetAsync<ItemRow>(this.database, 'SELECT * FROM items WHERE id = ?', itemId)

    return row ? mapItem(row) : null
  }

  listByBookId(bookId: string): Item[] {
    const rows = dbAll<ItemRow>(this.database, 'SELECT * FROM items WHERE book_id = ? ORDER BY created_at ASC', bookId)

    return rows.map(mapItem)
  }

  async listByBookIdAsync(bookId: string): Promise<Item[]> {
    const rows = await dbAllAsync<ItemRow>(
      this.database,
      'SELECT * FROM items WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map(mapItem)
  }
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    bookId: row.book_id,
    name: row.name,
    unit: row.unit,
    type: row.type,
    isUniqueWorldwide: row.is_unique_worldwide === 1,
    isImportant: row.is_important === 1,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
