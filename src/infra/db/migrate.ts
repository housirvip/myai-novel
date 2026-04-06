import type { NovelDatabase } from './database.js'
import { migrations } from './schema.js'
import { isSqliteDatabase } from './sqlite-support.js'

/**
 * 执行数据库迁移。
 *
 * 这里的目标不是做复杂 migration 框架，而是为当前项目提供一套可重复执行、幂等的最小迁移机制：
 * - 统一维护 `schema_migrations`
 * - 按顺序执行 `schema.ts` 中声明的 migrations
 * - 允许部分“可忽略重复列”错误安全跳过，兼容已存在的演进状态
 */
export async function runMigrations(database: NovelDatabase): Promise<void> {
  if (!isSqliteDatabase(database)) {
    await database.dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(191) PRIMARY KEY,
        applied_at VARCHAR(64) NOT NULL
      );
    `)
  } else {
    database.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)
  }

  for (const migration of migrations) {
    const alreadyApplied = await database.dbAsync.get<{ applied: number }>(
      'SELECT 1 as applied FROM schema_migrations WHERE id = ?',
      migration.id,
    )

    if (alreadyApplied) {
      continue
    }

    const transaction = database.dbAsync.transaction(async () => {
      await database.dbAsync.exec(migration.sql)
      await database.dbAsync.run(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        migration.id,
        new Date().toISOString(),
      )
    })

    try {
      await transaction()
    } catch (error) {
      if (!isIgnorableMigrationError(error)) {
        throw error
      }

      await database.dbAsync.run(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        migration.id,
        new Date().toISOString(),
      )
    }
  }
}

/**
 * 判断某次 migration 错误是否可以视为“已具备目标结构”的兼容情况。
 *
 * 当前仅对重复列错误做宽容处理，避免历史库在补迁移时因为已存在列而整批失败。
 */
function isIgnorableMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('duplicate column name')
}
