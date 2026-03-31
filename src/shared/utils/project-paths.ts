import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { z } from 'zod'

import type { ProjectConfig } from '../types/domain.js'

const projectConfigSchema = z.object({
  database: z.object({
    client: z.literal('sqlite'),
    filename: z.string().min(1),
  }),
})

export type ProjectPaths = {
  rootDir: string
  configDir: string
  dataDir: string
  completedChaptersDir: string
  exportsMarkdownDir: string
  logsDir: string
  databaseConfigPath: string
  databaseFilePath: string
}

export function resolveProjectPaths(rootDir: string): ProjectPaths {
  const configDir = path.join(rootDir, 'config')
  const dataDir = path.join(rootDir, 'data')

  return {
    rootDir,
    configDir,
    dataDir,
    completedChaptersDir: path.join(rootDir, 'completed-chapters'),
    exportsMarkdownDir: path.join(rootDir, 'exports', 'markdown'),
    logsDir: path.join(rootDir, 'logs'),
    databaseConfigPath: path.join(configDir, 'database.json'),
    databaseFilePath: path.join(dataDir, 'novel.sqlite'),
  }
}

export async function ensureProjectDirectories(paths: ProjectPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.configDir, { recursive: true }),
    mkdir(paths.dataDir, { recursive: true }),
    mkdir(paths.completedChaptersDir, { recursive: true }),
    mkdir(paths.exportsMarkdownDir, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
  ])
}

export async function writeProjectConfig(paths: ProjectPaths, config: ProjectConfig): Promise<void> {
  await writeFile(paths.databaseConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export async function readProjectConfig(rootDir: string): Promise<ProjectConfig> {
  const paths = resolveProjectPaths(rootDir)
  const raw = await readFile(paths.databaseConfigPath, 'utf8')
  return projectConfigSchema.parse(JSON.parse(raw))
}
