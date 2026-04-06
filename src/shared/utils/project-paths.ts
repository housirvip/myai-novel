import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { z } from 'zod'

import type { ProjectConfig } from '../types/domain.js'

/**
 * 本文件负责定义项目级目录布局与配置文件路径约定。
 *
 * 它的意义不是简单拼字符串，而是把 CLI、approve、logging、database 初始化
 * 共同依赖的目录结构收敛为一份稳定真源，避免路径规则散落在各个命令里。
 */

const projectConfigSchema = z.object({
  database: z.discriminatedUnion('client', [
    z.object({
      client: z.literal('sqlite'),
      filename: z.string().min(1),
    }),
    z.object({
      client: z.literal('mysql'),
      host: z.string().min(1),
      port: z.number().int().positive(),
      user: z.string().min(1),
      password: z.string().min(1).optional(),
      database: z.string().min(1),
    }),
  ]),
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

/**
 * 基于项目根目录推导全部标准路径。
 *
 * 后续只要项目目录布局发生变化，应优先改这里，
 * 而不是让各个 command / service 自己手写路径拼接规则。
 */
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

/**
 * 创建项目运行所需的标准目录。
 */
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

/**
 * 持久化项目数据库配置。
 */
export async function writeProjectConfig(paths: ProjectPaths, config: ProjectConfig): Promise<void> {
  await writeFile(paths.databaseConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

/**
 * 读取并校验项目配置文件。
 *
 * 这里使用 `zod` 的目的，是把“文件存在”与“结构合法”两件事同时收口，
 * 避免后续 database / CLI 层处理半有效配置。
 */
export async function readProjectConfig(rootDir: string): Promise<ProjectConfig> {
  const paths = resolveProjectPaths(rootDir)
  const raw = await readFile(paths.databaseConfigPath, 'utf8')
  return projectConfigSchema.parse(JSON.parse(raw))
}

/**
 * 规范化章节标题，使其可安全落盘为文件名。
 */
export function sanitizeChapterFilename(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

/**
 * 生成批准后章节文件名，保留稳定章节序号前缀，方便按文件系统排序。
 */
export function buildCompletedChapterFilename(index: number, title: string): string {
  return `${String(index).padStart(4, '0')}-${sanitizeChapterFilename(title)}.md`
}

/**
 * 确保日志目录存在。
 */
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
