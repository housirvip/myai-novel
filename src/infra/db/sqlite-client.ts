import type Database from 'better-sqlite3'

import type { NovelDatabase } from './database.js'
import { assertSqliteDatabase } from './sqlite-support.js'

type SqliteStatement = Database.Statement

export function sqlitePrepare(database: NovelDatabase, sql: string): SqliteStatement {
  return assertSqliteDatabase(database).prepare(sql)
}

export function sqliteGet<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T | undefined {
  return database.db.get<T>(sql, ...params)
}

export function sqliteAll<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T[] {
  return database.db.all<T>(sql, ...params)
}

export function sqliteRun(database: NovelDatabase, sql: string, ...params: unknown[]) {
  return database.db.run(sql, ...params)
}

export function sqliteTransaction<TArgs extends unknown[], TResult>(
  database: NovelDatabase,
  action: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return database.db.transaction(action)
}

export function sqliteExec(database: NovelDatabase, sql: string): void {
  database.db.exec(sql)
}
