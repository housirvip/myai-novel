import path from 'node:path'

import { openDatabase, type NovelDatabase } from '../infra/db/database.js'
import { runMigrations } from '../infra/db/migrate.js'
import type { LlmExecutionMetadata } from '../shared/types/domain.js'
import { createCommandLogger } from '../shared/utils/logging.js'
import { readProjectConfig } from '../shared/utils/project-paths.js'

export async function openProjectDatabase(): Promise<NovelDatabase> {
  const rootDir = process.cwd()
  const config = await readProjectConfig(rootDir)
  const database = openDatabase(
    config.database.client === 'sqlite'
      ? {
          ...config.database,
          filename: path.resolve(rootDir, config.database.filename),
        }
      : config.database,
  )

  await runMigrations(database)

  return database
}

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
