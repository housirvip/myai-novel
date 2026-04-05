import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  buildCompletedChapterFilename,
  ensureLogsDir,
  ensureProjectDirectories,
  readProjectConfig,
  resolveErrorLogFile,
  resolveOperationLogFile,
  resolveProjectPaths,
  sanitizeChapterFilename,
  writeProjectConfig,
} from '../../../src/shared/utils/project-paths.js'
import { withTempDir } from '../../helpers/fs.js'

test('resolveProjectPaths builds the expected project directory layout', () => {
  const rootDir = '/tmp/demo-book'
  const paths = resolveProjectPaths(rootDir)

  assert.equal(paths.configDir, path.join(rootDir, 'config'))
  assert.equal(paths.dataDir, path.join(rootDir, 'data'))
  assert.equal(paths.databaseConfigPath, path.join(rootDir, 'config', 'database.json'))
  assert.equal(paths.databaseFilePath, path.join(rootDir, 'data', 'novel.sqlite'))
  assert.equal(paths.operationLogsDir, path.join(rootDir, 'logs', 'operations'))
  assert.equal(paths.errorLogsDir, path.join(rootDir, 'logs', 'errors'))
})

test('project path helpers can create directories and persist project config', async () => {
  await withTempDir(async (rootDir) => {
    const paths = resolveProjectPaths(rootDir)
    const config = {
      database: {
        client: 'sqlite',
        filename: 'data/custom.sqlite',
      },
    } as const

    await ensureProjectDirectories(paths)
    await writeProjectConfig(paths, config)

    await access(paths.configDir)
    await access(paths.dataDir)
    await access(paths.completedChaptersDir)
    await access(paths.exportsMarkdownDir)
    await access(paths.logsDir)
    await access(paths.operationLogsDir)
    await access(paths.errorLogsDir)

    const raw = await readFile(paths.databaseConfigPath, 'utf8')
    assert.match(raw, /"client": "sqlite"/)

    const parsed = await readProjectConfig(rootDir)
    assert.deepEqual(parsed, config)
  })
})

test('filename helpers sanitize unsafe chapter names and add stable prefixes', () => {
  assert.equal(sanitizeChapterFilename('  Hello / World: Finale?  '), 'Hello - World- Finale-')
  assert.equal(buildCompletedChapterFilename(12, '  Hello / World: Finale?  '), '0012-Hello - World- Finale-.md')
})

test('log helpers create and resolve operation and error log locations', async () => {
  await withTempDir(async (rootDir) => {
    await ensureLogsDir(rootDir)

    const operationLogFile = resolveOperationLogFile(rootDir, '2026-04-05')
    const errorLogFile = resolveErrorLogFile(rootDir, '2026-04-05')

    await access(path.dirname(operationLogFile))
    await access(path.dirname(errorLogFile))
    assert.equal(operationLogFile, path.join(rootDir, 'logs', 'operations', '2026-04-05.ndjson'))
    assert.equal(errorLogFile, path.join(rootDir, 'logs', 'errors', '2026-04-05.ndjson'))
  })
})