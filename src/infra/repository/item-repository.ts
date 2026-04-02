import type { Item } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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
    this.database
      .prepare(
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
      )
      .run(
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
    const row = this.database.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as ItemRow | undefined

    return row ? mapItem(row) : null
  }

  listByBookId(bookId: string): Item[] {
    const rows = this.database
      .prepare('SELECT * FROM items WHERE book_id = ? ORDER BY created_at ASC')
      .all(bookId) as ItemRow[]

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
