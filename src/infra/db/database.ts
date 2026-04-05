import Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import { createMySqlAdapter, type DatabaseRunResult, type MySqlAdapter } from './mysql-adapter.js'

export type DatabaseReadApi = {
  get<T>(sql: string, ...params: unknown[]): T | undefined
  all<T>(sql: string, ...params: unknown[]): T[]
}

export type DatabaseWriteApi = {
  run(sql: string, ...params: unknown[]): DatabaseRunResult
  exec(sql: string): void
  transaction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult): (...args: TArgs) => TResult
}

export type SqliteDatabaseHandle = {
  client: 'sqlite'
  sqlite: Database.Database
  db: DatabaseReadApi & DatabaseWriteApi
  close(): void
}

export type MySqlDatabaseHandle = {
  client: 'mysql'
  mysql: MySqlAdapter
  db: DatabaseReadApi & DatabaseWriteApi
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
      db: {
        get: mysql.get,
        all: mysql.all,
        run: mysql.run,
        exec: mysql.exec,
        transaction: mysql.transaction,
      },
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
    db: {
      get<T>(sql: string, ...params: unknown[]): T | undefined {
        return sqlite.prepare(sql).get(...params) as T | undefined
      },
      all<T>(sql: string, ...params: unknown[]): T[] {
        return sqlite.prepare(sql).all(...params) as T[]
      },
      run(sql: string, ...params: unknown[]): DatabaseRunResult {
        return sqlite.prepare(sql).run(...params)
      },
      exec(sql: string): void {
        sqlite.exec(sql)
      },
      transaction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
        return sqlite.transaction(action)
      },
    },
    close(): void {
      sqlite.close()
    },
  }
}
