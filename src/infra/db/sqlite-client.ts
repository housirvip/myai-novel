import type Database from 'better-sqlite3'

import type { NovelDatabase } from './database.js'
import { assertSqliteDatabase } from './sqlite-support.js'

type SqliteStatement = Database.Statement

export function sqlitePrepare(database: NovelDatabase, sql: string): SqliteStatement {
  return assertSqliteDatabase(database).prepare(sql)
}

export function sqliteGet<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T | undefined {
  return sqlitePrepare(database, sql).get(...params) as T | undefined
}

export function sqliteAll<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T[] {
  return sqlitePrepare(database, sql).all(...params) as T[]
}

export function sqliteRun(database: NovelDatabase, sql: string, ...params: unknown[]): Database.RunResult {
  return sqlitePrepare(database, sql).run(...params)
}

export function sqliteTransaction<TArgs extends unknown[]>(
  database: NovelDatabase,
  action: (...args: TArgs) => void,
): (...args: TArgs) => void {
  return assertSqliteDatabase(database).transaction(action)
}

export function sqliteExec(database: NovelDatabase, sql: string): void {
  assertSqliteDatabase(database).exec(sql)
}
