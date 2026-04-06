import type Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import type { NovelDatabase, SqliteDatabaseHandle } from './database.js'

/**
 * SQLite / MySQL 双后端下的类型守卫辅助。
 *
 * 这类 helper 的意义是把“当前是不是 sqlite”这件事显式化，
 * 让 migration、测试和 sqlite-only 操作不必依赖脆弱的手工类型断言。
 */
export function isSqliteConfig(config: DatabaseConfig): config is Extract<DatabaseConfig, { client: 'sqlite' }> {
  return config.client === 'sqlite'
}

export function isSqliteDatabase(database: NovelDatabase): database is SqliteDatabaseHandle {
  return database.client === 'sqlite'
}

/**
 * 在调用方明确需要 sqlite 句柄时执行强校验。
 */
export function assertSqliteDatabase(database: NovelDatabase): Database.Database {
  if (!isSqliteDatabase(database)) {
    throw new Error('SQLite-only execution was requested, but current project is configured to use MySQL.')
  }

  return database.sqlite
}
