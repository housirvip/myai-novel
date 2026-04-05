import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'

/**
 * Creates an isolated temporary directory for a test and removes it afterwards.
 */
export async function withTempDir<T>(run: (tempDir: string) => T | Promise<T>): Promise<T> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'myai-novel-test-'))

  try {
    return await run(tempDir)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}