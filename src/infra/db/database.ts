import Database from 'better-sqlite3'

import type { DatabaseConfig } from '../../shared/types/domain.js'
import { createMySqlAdapter, type DatabaseRunResult, type MySqlAdapter } from './mysql-adapter.js'

/**
 * 本文件负责把 SQLite / MySQL 两种后端收敛成统一的 `NovelDatabase` 访问门面。
 *
 * 这里的设计重点不是隐藏差异，而是把“读写 API 长得一样”与“后端能力边界仍然可见”同时保住：
 * - SQLite 保留同步与异步两套接口
 * - MySQL 明确以 async 为主，sync 操作走 adapter 内部拒绝
 */

export type DatabaseReadApi = {
  get<T>(sql: string, ...params: unknown[]): T | undefined
  all<T>(sql: string, ...params: unknown[]): T[]
}

export type DatabaseWriteApi = {
  run(sql: string, ...params: unknown[]): DatabaseRunResult
  exec(sql: string): void
  transaction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult): (...args: TArgs) => TResult
}

export type AsyncDatabaseReadApi = {
  get<T>(sql: string, ...params: unknown[]): Promise<T | undefined>
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>
}

export type AsyncDatabaseWriteApi = {
  run(sql: string, ...params: unknown[]): Promise<DatabaseRunResult>
  exec(sql: string): Promise<void>
  transaction<TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult> | TResult,
  ): (...args: TArgs) => Promise<TResult>
}

export type SqliteDatabaseHandle = {
  client: 'sqlite'
  sqlite: Database.Database
  db: DatabaseReadApi & DatabaseWriteApi
  dbAsync: AsyncDatabaseReadApi & AsyncDatabaseWriteApi
  close(): void
}

export type MySqlDatabaseHandle = {
  client: 'mysql'
  mysql: MySqlAdapter
  db: DatabaseReadApi & DatabaseWriteApi
  dbAsync: AsyncDatabaseReadApi & AsyncDatabaseWriteApi
  close(): void
}

export type NovelDatabase = SqliteDatabaseHandle | MySqlDatabaseHandle

/**
 * 打开项目数据库。
 *
 * 支持两种输入形式：
 * - 直接给 sqlite 文件名，视作快捷 sqlite 模式
 * - 给完整 `DatabaseConfig`，按 `client` 决定具体后端
 *
 * SQLite 分支会显式开启：
 * - `journal_mode = WAL`
 * - `foreign_keys = ON`
 *
 * 这样可以确保测试环境和正式运行环境共享同一套最小一致性基线。
 */
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
      dbAsync: {
        get: mysql.getAsync,
        all: mysql.allAsync,
        run: mysql.runAsync,
        exec: mysql.execAsync,
        transaction: mysql.transactionAsync,
      },
      close(): void {
        void mysql.close()
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
    dbAsync: {
      async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
        return sqlite.prepare(sql).get(...params) as T | undefined
      },
      async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
        return sqlite.prepare(sql).all(...params) as T[]
      },
      async run(sql: string, ...params: unknown[]): Promise<DatabaseRunResult> {
        return sqlite.prepare(sql).run(...params)
      },
      async exec(sql: string): Promise<void> {
        sqlite.exec(sql)
      },
      transaction<TArgs extends unknown[], TResult>(
        action: (...args: TArgs) => Promise<TResult> | TResult,
      ): (...args: TArgs) => Promise<TResult> {
        return async (...args: TArgs): Promise<TResult> => {
          sqlite.exec('BEGIN')

          try {
            const result = await action(...args)
            sqlite.exec('COMMIT')
            return result
          } catch (error) {
            sqlite.exec('ROLLBACK')
            throw error
          }
        }
      },
    },
    close(): void {
      sqlite.close()
    },
  }
}
