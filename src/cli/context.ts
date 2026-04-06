import path from 'node:path'

import { openDatabase, type NovelDatabase } from '../infra/db/database.js'
import { runMigrations } from '../infra/db/migrate.js'
import type { LlmExecutionMetadata } from '../shared/types/domain.js'
import { NovelError, toErrorMessage } from '../shared/utils/errors.js'
import { createCommandLogger } from '../shared/utils/logging.js'
import { readProjectConfig } from '../shared/utils/project-paths.js'

/**
 * CLI 上下文层负责把“项目配置 + 数据库 + 命令日志”装配成各个命令可复用的运行入口。
 *
 * 它的职责不是保存业务逻辑，而是：
 * - 打开并迁移项目数据库
 * - 提供统一的命令执行日志包装
 * - 提供少量 CLI 参数解析与 LLM metadata 摘要工具
 */

/**
 * 打开当前工作目录对应的项目数据库，并确保 migrations 已执行。
 *
 * 这是绝大多数 CLI 命令的统一数据库入口，
 * 因此这里要把“配置读取失败 / 打库失败 / migration 失败”统一收口为稳定的 `NovelError`。
 */
export async function openProjectDatabase(): Promise<NovelDatabase> {
  const rootDir = process.cwd()

  try {
    const config = await readProjectConfig(rootDir)
    const database = openDatabase(
      config.database.client === 'sqlite'
        ? {
            ...config.database,
            filename: path.resolve(rootDir, config.database.filename),
          }
        : config.database,
    )

    try {
      if (database.client === 'mysql') {
        await database.mysql.connect()
      }

      await runMigrations(database)
      return database
    } catch (error) {
      database.close()
      throw error
    }
  } catch (error) {
    throw new NovelError(`Failed to open project database: ${toErrorMessage(error)}`)
  }
}

/**
 * 为命令执行提供“打开数据库 + 执行动作 + 记录成功/失败日志 + 关闭数据库”的统一包装。
 *
 * 各具体命令应尽量把真实业务逻辑放进 `action`，
 * 而不是自己重复处理日志、数据库关闭与错误记录细节。
 */
export async function runLoggedCommand<T>(input: {
  command: string
  args: string[]
  chapterId?: string
  bookId?: string
  detail?: Record<string, unknown>
  action: (database: NovelDatabase) => Promise<{
    result: T
    summary: string
    detail?: Record<string, unknown>
    bookId?: string
    chapterId?: string
  }>
}): Promise<T> {
  const logger = createCommandLogger(process.cwd(), input.command, input.args)
  const startedAt = Date.now()
  const database = await openProjectDatabase()

  try {
    const outcome = await input.action(database)

    await logger.success({
      chapterId: outcome.chapterId ?? input.chapterId,
      bookId: outcome.bookId ?? input.bookId,
      durationMs: Date.now() - startedAt,
      summary: outcome.summary,
      detail: outcome.detail ?? input.detail,
    })

    return outcome.result
  } catch (error) {
    await logger.failure(error, {
      chapterId: input.chapterId,
      bookId: input.bookId,
      durationMs: Date.now() - startedAt,
      summary: `${input.command} failed`,
      detail: input.detail,
    })

    throw error
  } finally {
    database.close()
  }
}

export function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer: ${value}`)
  }

  return parsed
}

export function parseFloatNumber(value: string): number {
  const parsed = Number.parseFloat(value)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return parsed
}

/**
 * 提取适合日志、doctor、CLI 输出展示的 LLM metadata 子集。
 *
 * 这里故意不原样返回完整 metadata，避免把底层噪声字段直接暴露到命令视图层。
 */
export function summarizeLlmMetadata(metadata?: LlmExecutionMetadata): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined
  }

  return {
    stage: metadata.stage,
    selectedProvider: metadata.selectedProvider,
    selectedModel: metadata.selectedModel,
    requestedProvider: metadata.requestedProvider,
    requestedModel: metadata.requestedModel,
    providerSource: metadata.providerSource,
    modelSource: metadata.modelSource,
    fallbackUsed: metadata.fallbackUsed,
    fallbackFromProvider: metadata.fallbackFromProvider,
    latencyMs: metadata.latencyMs,
    retryCount: metadata.retryCount,
    responseId: metadata.responseId,
    requestId: metadata.requestId,
  }
}
