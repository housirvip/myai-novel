import type { NovelDatabase } from './database.js'

/**
 * 本文件提供数据库访问的薄包装函数。
 *
 * 它的意义不是增加额外逻辑，而是把 repository 层常用的读写入口统一成稳定函数名，
 * 便于后续替换底层 database 门面时减少直接耦合面。
 */

export function dbGet<T>(database: NovelDatabase, sql: string, ...params: unknown[]): T | undefined {
  return database.db.get<T>(sql, ...params)
}

/**
 * async 包装主要服务于 MySQL / async repository 链路。
 *
 * 即使在 sqlite 下它看起来只是“再包一层 Promise”，
 * 保留这组稳定入口也能让 repository 不必知道当前后端是不是 sync-first。
 */
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
