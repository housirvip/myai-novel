import type { Faction } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbRun } from '../db/db-client.js'

// 势力目前只有基础设定写入能力；读取侧暂时由更高层聚合或后续仓储扩展承接。
export class FactionRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(faction: Faction): void {
    dbRun(
      this.database,
      `
        INSERT INTO factions (
          id, book_id, name, type, objective, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      faction.id,
      faction.bookId,
      faction.name,
      faction.type,
      faction.objective,
      faction.description,
      faction.createdAt,
      faction.updatedAt,
    )
  }
}
