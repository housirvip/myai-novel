import type Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import type { NovelDatabase, SqliteDatabaseHandle } from './database.js'

export function isSqliteConfig(config: DatabaseConfig): config is Extract<DatabaseConfig, { client: 'sqlite' }> {
  return config.client === 'sqlite'
}

export function isSqliteDatabase(database: NovelDatabase): database is SqliteDatabaseHandle {
  return database.client === 'sqlite'
}

export function assertSqliteDatabase(database: NovelDatabase): Database.Database {
  if (!isSqliteDatabase(database)) {
    throw new Error('SQLite-only execution was requested, but current project is configured to use MySQL.')
  }

  return database.sqlite
}
