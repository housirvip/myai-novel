import type { MySqlDatabaseConfig } from '../../shared/types/domain.js'

export type DatabaseRunResult = {
  changes?: number
  lastInsertRowid?: number | bigint
}

/**
 * `v5` 当前阶段先把 MySQL 后端抽成独立基础设施单元，
 * 避免把未完成的连接细节散落到 [`openDatabase()`](src/infra/db/database.ts:5)
 * 和各个 repository 中。
 *
 * 这里先提供最小骨架：
 * - 保存标准化后的 MySQL 配置
 * - 暴露统一的 connect / close 生命周期入口
 * - 在 repository 还未异步化前，明确抛出“暂未接通执行链路”错误
 */
export type MySqlAdapter = {
  client: 'mysql'
  config: MySqlDatabaseConfig
  connect(): never
  get<T>(sql: string, ...params: unknown[]): T | undefined
  all<T>(sql: string, ...params: unknown[]): T[]
  run(sql: string, ...params: unknown[]): DatabaseRunResult
  exec(sql: string): void
  transaction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult): (...args: TArgs) => TResult
  close(): void
}

export function createMySqlAdapter(config: MySqlDatabaseConfig): MySqlAdapter {
  return {
    client: 'mysql',
    config,
    connect(): never {
      throw new Error('MySQL backend is configured but repository execution is not wired yet in v5.')
    },
    get<T>(_sql: string, ..._params: unknown[]): T | undefined {
      throw new Error('MySQL backend is configured but query execution is not wired yet in v5.')
    },
    all<T>(_sql: string, ..._params: unknown[]): T[] {
      throw new Error('MySQL backend is configured but query execution is not wired yet in v5.')
    },
    run(_sql: string, ..._params: unknown[]): DatabaseRunResult {
      throw new Error('MySQL backend is configured but command execution is not wired yet in v5.')
    },
    exec(_sql: string): void {
      throw new Error('MySQL backend is configured but migration execution is not wired yet in v5.')
    },
    transaction<TArgs extends unknown[], TResult>(_action: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
      throw new Error('MySQL backend is configured but transaction execution is not wired yet in v5.')
    },
    close(): void {
    },
  }
}
