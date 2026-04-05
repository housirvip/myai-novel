import type { NovelDatabase } from '../db/database.js'
import type { Volume } from '../../shared/types/domain.js'
import { sqliteAll, sqliteGet, sqliteRun } from '../db/sqlite-client.js'

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

export class VolumeRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(volume: Volume): void {
    sqliteRun(
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
    const row = sqliteGet<VolumeRow>(this.database, 'SELECT * FROM volumes WHERE id = ?', id)

    return row ? mapVolume(row) : null
  }

  getByChapterId(chapterId: string): Volume | null {
    const row = sqliteGet<VolumeRow>(
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
    sqliteRun(
      this.database,
      'UPDATE volumes SET chapter_ids_json = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(chapterIds),
      updatedAt,
      id,
    )
  }

  listByBookId(bookId: string): Volume[] {
    const rows = sqliteAll<VolumeRow>(
      this.database,
      'SELECT * FROM volumes WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    )

    return rows.map(mapVolume)
  }
}

function mapVolume(row: VolumeRow): Volume {
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
