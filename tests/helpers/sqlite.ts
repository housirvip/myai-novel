import path from 'node:path'

import type { NovelDatabase } from '../../src/infra/db/database.js'
import { openDatabase } from '../../src/infra/db/database.js'
import { runMigrations } from '../../src/infra/db/migrate.js'
import { withTempDir } from './fs.js'

// 大多数仓储/服务测试都依赖真实迁移后的 sqlite，因此这里统一负责建库、迁移、回收。
export async function withSqliteDatabase<T>(
  run: (database: NovelDatabase, input: { rootDir: string; filename: string }) => T | Promise<T>,
): Promise<T> {
  return withTempDir(async (rootDir) => {
    const filename = path.join(rootDir, 'test.sqlite')
    const database = openDatabase(filename)

    try {
      await runMigrations(database)
      return await run(database, { rootDir, filename })
    } finally {
      database.close()
    }
  })
}

export async function insertVolumeAndChapter(
  database: NovelDatabase,
  input: {
    bookId: string
    volumeId?: string
    chapterId?: string
    timestamp?: string
  },
): Promise<{ volumeId: string; chapterId: string }> {
  // 这个 helper 故意只插入“最小卷 + 最小章节”组合，适合作为大多数 repository 测试的起点。
  const volumeId = input.volumeId ?? 'volume-1'
  const chapterId = input.chapterId ?? 'chapter-1'
  const timestamp = input.timestamp ?? '2026-04-06T00:00:00.000Z'

  await database.dbAsync.run(
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
    volumeId,
    input.bookId,
    '第一卷',
    '逼近真相',
    '卷摘要',
    JSON.stringify([chapterId]),
    timestamp,
    timestamp,
  )

  await database.dbAsync.run(
    `
      INSERT INTO chapters (
        id,
        book_id,
        volume_id,
        chapter_index,
        title,
        objective,
        planned_beats_json,
        status,
        current_plan_version_id,
        current_version_id,
        draft_path,
        final_path,
        approved_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    chapterId,
    input.bookId,
    volumeId,
    1,
    '暗潮',
    '查明敌营动向',
    JSON.stringify(['潜入据点', '发现密信']),
    'planned',
    null,
    null,
    null,
    null,
    null,
    timestamp,
    timestamp,
  )

  return { volumeId, chapterId }
}
