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
  operationLogsDir: string
  errorLogsDir: string
  databaseConfigPath: string
  databaseFilePath: string
}

export function resolveProjectPaths(rootDir: string): ProjectPaths {
  const configDir = path.join(rootDir, 'config')
  const dataDir = path.join(rootDir, 'data')

  const logsDir = path.join(rootDir, 'logs')

  return {
    rootDir,
    configDir,
    dataDir,
    completedChaptersDir: path.join(rootDir, 'completed-chapters'),
    exportsMarkdownDir: path.join(rootDir, 'exports', 'markdown'),
    logsDir,
    operationLogsDir: path.join(logsDir, 'operations'),
    errorLogsDir: path.join(logsDir, 'errors'),
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
    mkdir(paths.operationLogsDir, { recursive: true }),
    mkdir(paths.errorLogsDir, { recursive: true }),
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

export function sanitizeChapterFilename(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

export function buildCompletedChapterFilename(index: number, title: string): string {
  return `${String(index).padStart(4, '0')}-${sanitizeChapterFilename(title)}.md`
}

export function ensureLogsDir(rootDir: string): Promise<void> {
  const paths = resolveProjectPaths(rootDir)

  return Promise.all([
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.operationLogsDir, { recursive: true }),
    mkdir(paths.errorLogsDir, { recursive: true }),
  ]).then(() => undefined)
}

export function resolveOperationLogDir(rootDir: string): string {
  return resolveProjectPaths(rootDir).operationLogsDir
}

export function resolveErrorLogDir(rootDir: string): string {
  return resolveProjectPaths(rootDir).errorLogsDir
}

export function resolveOperationLogFile(rootDir: string, date: string): string {
  return path.join(resolveOperationLogDir(rootDir), `${date}.ndjson`)
}

export function resolveErrorLogFile(rootDir: string, date: string): string {
  return path.join(resolveErrorLogDir(rootDir), `${date}.ndjson`)
}
