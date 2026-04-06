import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  openProjectDatabase,
  parseFloatNumber,
  parseInteger,
  runLoggedCommand,
  summarizeLlmMetadata,
} from '../../../src/cli/context.js'
import { NovelError } from '../../../src/shared/utils/errors.js'
import {
  ensureProjectDirectories,
  resolveProjectPaths,
  writeProjectConfig,
} from '../../../src/shared/utils/project-paths.js'
import { withTempDir } from '../../helpers/fs.js'
import { withCwd } from '../../helpers/process.js'

test('parseInteger and parseFloatNumber parse valid values and reject invalid input', () => {
  assert.equal(parseInteger('12'), 12)
  assert.equal(parseFloatNumber('3.14'), 3.14)
  assert.throws(() => parseInteger('abc'), /Invalid integer: abc/)
  assert.throws(() => parseFloatNumber('oops'), /Invalid number: oops/)
})

test('summarizeLlmMetadata returns a stable subset and handles undefined', () => {
  assert.equal(summarizeLlmMetadata(undefined), undefined)

  assert.deepEqual(
    summarizeLlmMetadata({
      stage: 'review',
      selectedProvider: 'openai-compatible',
      selectedModel: 'gpt-router',
      requestedProvider: 'openai',
      requestedModel: 'gpt-openai',
      providerSource: 'stage-routing',
      modelSource: 'provider-default',
      fallbackUsed: true,
      fallbackFromProvider: 'openai',
      latencyMs: 432,
      retryCount: 1,
      responseId: 'response-1',
      requestId: 'request-1',
    }),
    {
      stage: 'review',
      selectedProvider: 'openai-compatible',
      selectedModel: 'gpt-router',
      requestedProvider: 'openai',
      requestedModel: 'gpt-openai',
      providerSource: 'stage-routing',
      modelSource: 'provider-default',
      fallbackUsed: true,
      fallbackFromProvider: 'openai',
      latencyMs: 432,
      retryCount: 1,
      responseId: 'response-1',
      requestId: 'request-1',
    },
  )
})

test('openProjectDatabase opens configured sqlite project database and wraps missing config as NovelError', async () => {
  await withTempDir(async (rootDir) => {
    const paths = resolveProjectPaths(rootDir)
    await ensureProjectDirectories(paths)
    await writeProjectConfig(paths, {
      database: {
        client: 'sqlite',
        filename: 'data/test.sqlite',
      },
    })

    await withCwd(rootDir, async () => {
      const database = await openProjectDatabase()

      try {
        assert.equal(database.client, 'sqlite')
        const pragma = await database.dbAsync.get<{ foreign_keys: number }>('PRAGMA foreign_keys')
        assert.equal(pragma?.foreign_keys, 1)
      } finally {
        database.close()
      }
    })
  })

  await withTempDir(async (rootDir) => {
    await withCwd(rootDir, async () => {
      await assert.rejects(
        () => openProjectDatabase(),
        (error: unknown) => {
          assert.ok(error instanceof NovelError)
          assert.match(error.message, /Failed to open project database/)
          return true
        },
      )
    })
  })
})

test('runLoggedCommand returns results and writes success/failure logs', async () => {
  await withTempDir(async (rootDir) => {
    const paths = resolveProjectPaths(rootDir)
    await ensureProjectDirectories(paths)
    await writeProjectConfig(paths, {
      database: {
        client: 'sqlite',
        filename: 'data/test.sqlite',
      },
    })

    await withCwd(rootDir, async () => {
      const result = await runLoggedCommand({
        command: 'novel test-command',
        args: ['--ok'],
        bookId: 'book-1',
        chapterId: 'chapter-1',
        detail: { mode: 'success' },
        action: async () => ({
          result: 'done',
          summary: 'command success',
          detail: { mode: 'success', step: 'finished' },
          bookId: 'book-1',
          chapterId: 'chapter-1',
        }),
      })

      assert.equal(result, 'done')

      await assert.rejects(
        () =>
          runLoggedCommand({
            command: 'novel test-command',
            args: ['--fail'],
            bookId: 'book-1',
            chapterId: 'chapter-1',
            detail: { mode: 'failure' },
            action: async () => {
              throw new Error('boom')
            },
          }),
        /boom/,
      )
    })

    const operationFiles = await readdir(paths.operationLogsDir)
    const errorFiles = await readdir(paths.errorLogsDir)
    assert.equal(operationFiles.length >= 1, true)
    assert.equal(errorFiles.length >= 1, true)

    const operationLog = await readFile(path.join(paths.operationLogsDir, operationFiles[0] ?? ''), 'utf8')
    const errorLog = await readFile(path.join(paths.errorLogsDir, errorFiles[0] ?? ''), 'utf8')

    assert.match(operationLog, /command success/)
    assert.match(operationLog, /"status":"success"/)
    assert.match(errorLog, /"status":"failed"/)
    assert.match(errorLog, /boom/)
  })
})