import { appendFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

import type { OperationLog, OperationLogLevel } from '../types/domain.js'
import { ensureLogsDir, resolveErrorLogFile, resolveOperationLogFile } from './project-paths.js'
import { nowIso } from './time.js'

export type CommandLogger = {
  runId: string
  command: string
  args: string[]
  cwd: string
  success(input: CommandLogPayload): Promise<void>
  failure(error: unknown, input: CommandLogPayload): Promise<void>
}

export type CommandLogPayload = {
  level?: OperationLogLevel
  timestamp?: string
  bookId?: string
  chapterId?: string
  durationMs?: number
  summary: string
  detail?: Record<string, unknown>
}

export function createRunId(): string {
  return `run_${randomUUID()}`
}

export function createCommandLogger(rootDir: string, command: string, args: string[], cwd = process.cwd()): CommandLogger {
  const runId = createRunId()

  return {
    runId,
    command,
    args,
    cwd,
    async success(input: CommandLogPayload): Promise<void> {
      await appendOperationLog(rootDir, {
        runId,
        timestamp: input.timestamp ?? nowIso(),
        level: input.level ?? 'info',
        command,
        args,
        cwd,
        bookId: input.bookId,
        chapterId: input.chapterId,
        status: 'success',
        durationMs: input.durationMs,
        summary: input.summary,
        detail: input.detail,
      })
    },
    async failure(error: unknown, input: CommandLogPayload): Promise<void> {
      await appendOperationLog(rootDir, {
        runId,
        timestamp: input.timestamp ?? nowIso(),
        level: input.level ?? 'error',
        command,
        args,
        cwd,
        bookId: input.bookId,
        chapterId: input.chapterId,
        status: 'failed',
        durationMs: input.durationMs,
        summary: input.summary,
        detail: input.detail,
        error: normalizeError(error),
      })
    },
  }
}

export async function appendOperationLog(rootDir: string, entry: OperationLog): Promise<void> {
  try {
    await ensureLogsDir(rootDir)
    const date = entry.timestamp.slice(0, 10)
    const line = `${JSON.stringify(entry)}\n`

    await appendFile(resolveOperationLogFile(rootDir, date), line, 'utf8')

    if (entry.status === 'failed' || entry.level === 'error') {
      await appendFile(resolveErrorLogFile(rootDir, date), line, 'utf8')
    }
  } catch {
    return
  }
}

function normalizeError(error: unknown): OperationLog['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}
