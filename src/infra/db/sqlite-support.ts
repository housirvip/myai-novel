import type Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import type { NovelDatabase } from './database.js'

export function isSqliteConfig(config: DatabaseConfig): config is Extract<DatabaseConfig, { client: 'sqlite' }> {
  return config.client === 'sqlite'
}

export function assertSqliteDatabase(database: NovelDatabase): Database.Database {
  return database
}
