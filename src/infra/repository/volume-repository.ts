import type { NovelDatabase } from '../db/database.js'
import type { Volume } from '../../shared/types/domain.js'

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
    this.database
      .prepare(
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
      )
      .run(
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
    const row = this.database.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as
      | VolumeRow
      | undefined

    return row ? mapVolume(row) : null
  }

  getByChapterId(chapterId: string): Volume | null {
    const row = this.database
      .prepare(
        `
          SELECT v.*
          FROM volumes v
          INNER JOIN chapters c ON c.volume_id = v.id
          WHERE c.id = ?
        `,
      )
      .get(chapterId) as VolumeRow | undefined

    return row ? mapVolume(row) : null
  }

  updateChapterIds(id: string, chapterIds: string[], updatedAt: string): void {
    this.database
      .prepare('UPDATE volumes SET chapter_ids_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(chapterIds), updatedAt, id)
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
