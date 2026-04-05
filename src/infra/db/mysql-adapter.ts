import { AsyncLocalStorage } from 'node:async_hooks'

import { createPool, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'

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
  connect(): Promise<void>
  get<T>(sql: string, ...params: unknown[]): T | undefined
  all<T>(sql: string, ...params: unknown[]): T[]
  run(sql: string, ...params: unknown[]): DatabaseRunResult
  exec(sql: string): void
  transaction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult): (...args: TArgs) => TResult
  getAsync<T>(sql: string, ...params: unknown[]): Promise<T | undefined>
  allAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>
  runAsync(sql: string, ...params: unknown[]): Promise<DatabaseRunResult>
  execAsync(sql: string): Promise<void>
  transactionAsync<TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult> | TResult,
  ): (...args: TArgs) => Promise<TResult>
  close(): Promise<void>
}

export function createMySqlAdapter(config: MySqlDatabaseConfig): MySqlAdapter {
  const pool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
  })
  const connectionStore = new AsyncLocalStorage<PoolConnection>()

  function notWiredSync(operation: string): never {
    throw new Error(`MySQL backend requires async database access. Sync operation is not supported: ${operation}.`)
  }

  async function withExecutor<T>(action: (executor: Pool | PoolConnection) => Promise<T>): Promise<T> {
    const activeConnection = connectionStore.getStore()
    return action(activeConnection ?? pool)
  }

  return {
    client: 'mysql',
    config,
    async connect(): Promise<void> {
      const connection = await pool.getConnection()
      connection.release()
    },
    get<T>(_sql: string, ..._params: unknown[]): T | undefined {
      return notWiredSync('get')
    },
    all<T>(_sql: string, ..._params: unknown[]): T[] {
      return notWiredSync('all')
    },
    run(_sql: string, ..._params: unknown[]): DatabaseRunResult {
      return notWiredSync('run')
    },
    exec(_sql: string): void {
      return notWiredSync('exec')
    },
    transaction<TArgs extends unknown[], TResult>(_action: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
      return notWiredSync('transaction')
    },
    async getAsync<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      return withExecutor(async (executor) => {
        const [rows] = await executor.query<RowDataPacket[]>(sql, params)
        return rows[0] as T | undefined
      })
    },
    async allAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      return withExecutor(async (executor) => {
        const [rows] = await executor.query<RowDataPacket[]>(sql, params)
        return rows as T[]
      })
    },
    async runAsync(sql: string, ...params: unknown[]): Promise<DatabaseRunResult> {
      return withExecutor(async (executor) => {
        const [result] = await executor.query<ResultSetHeader>(sql, params)
        return {
          changes: result.affectedRows,
          lastInsertRowid: result.insertId,
        }
      })
    },
    async execAsync(sql: string): Promise<void> {
      await withExecutor(async (executor) => {
        await executor.query(sql)
      })
    },
    transactionAsync<TArgs extends unknown[], TResult>(
      action: (...args: TArgs) => Promise<TResult> | TResult,
    ): (...args: TArgs) => Promise<TResult> {
      return async (...args: TArgs): Promise<TResult> => {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()
          const result = await connectionStore.run(connection, async () => action(...args))
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          throw error
        } finally {
          connection.release()
        }
      }
    },
    async close(): Promise<void> {
      await pool.end()
    },
  }
}
