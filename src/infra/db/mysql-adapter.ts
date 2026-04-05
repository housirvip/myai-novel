import type { MySqlDatabaseConfig } from '../../shared/types/domain.js'

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
  close(): void
}

export function createMySqlAdapter(config: MySqlDatabaseConfig): MySqlAdapter {
  return {
    client: 'mysql',
    config,
    connect(): never {
      throw new Error('MySQL backend is configured but repository execution is not wired yet in v5.')
    },
    close(): void {
    },
  }
}
