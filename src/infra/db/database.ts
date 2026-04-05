import Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import { createMySqlAdapter } from './mysql-adapter.js'

export type NovelDatabase = Database.Database

export function openDatabase(input: string | DatabaseConfig): NovelDatabase {
  const config = typeof input === 'string'
    ? { client: 'sqlite' as const, filename: input }
    : input

  if (config.client === 'mysql') {
    createMySqlAdapter(config).connect()
  }

  const database = new Database(
    config.client === 'sqlite' ? config.filename : 'data/novel.sqlite'
  )

  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  return database
}
