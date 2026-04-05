import Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import { createMySqlAdapter, type MySqlAdapter } from './mysql-adapter.js'

export type SqliteDatabaseHandle = {
  client: 'sqlite'
  sqlite: Database.Database
  close(): void
}

export type MySqlDatabaseHandle = {
  client: 'mysql'
  mysql: MySqlAdapter
  close(): void
}

export type NovelDatabase = SqliteDatabaseHandle | MySqlDatabaseHandle

export function openDatabase(input: string | DatabaseConfig): NovelDatabase {
  const config = typeof input === 'string'
    ? { client: 'sqlite' as const, filename: input }
    : input

  if (config.client === 'mysql') {
    const mysql = createMySqlAdapter(config)

    return {
      client: 'mysql',
      mysql,
      close(): void {
        mysql.close()
      },
    }
  }

  const sqlite = new Database(config.filename)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return {
    client: 'sqlite',
    sqlite,
    close(): void {
      sqlite.close()
    },
  }
}
