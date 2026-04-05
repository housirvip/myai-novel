import type { NovelDatabase } from './database.js'

export function dbGet<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T | undefined {
  return database.db.get<T>(sql, ...params)
}

export function dbGetAsync<T>(database: NovelDatabase, sql: string, ...params: unknown[]): Promise<T | undefined> {
  return database.dbAsync.get<T>(sql, ...params)
}

export function dbAll<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T[] {
  return database.db.all<T>(sql, ...params)
}

export function dbAllAsync<T>(database: NovelDatabase, sql: string, ...params: unknown[]): Promise<T[]> {
  return database.dbAsync.all<T>(sql, ...params)
}

export function dbRun(database: NovelDatabase, sql: string, ...params: unknown[]) {
  return database.db.run(sql, ...params)
}

export function dbRunAsync(database: NovelDatabase, sql: string, ...params: unknown[]) {
  return database.dbAsync.run(sql, ...params)
}

export function dbTransaction<TArgs extends unknown[], TResult>(
  database: NovelDatabase,
  action: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return database.db.transaction(action)
}

export function dbTransactionAsync<TArgs extends unknown[], TResult>(
  database: NovelDatabase,
  action: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  return database.dbAsync.transaction(action)
}

export function dbExec(database: NovelDatabase, sql: string): void {
  database.db.exec(sql)
}

export function dbExecAsync(database: NovelDatabase, sql: string): Promise<void> {
  return database.dbAsync.exec(sql)
}