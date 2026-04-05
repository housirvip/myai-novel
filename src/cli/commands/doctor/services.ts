import { existsSync, readFileSync } from 'node:fs'

import type { NovelDatabase } from '../../../infra/db/database.js'
import type { LlmTaskStage } from '../../../shared/types/domain.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { readLlmEnv, readLlmStageConfig } from '../../../shared/utils/env.js'
import { resolveOperationLogDir, resolveProjectPaths } from '../../../shared/utils/project-paths.js'

type DoctorInfrastructureView = {
  database: {
    activeBackend: NovelDatabase['client'] | 'unconfigured'
    configPath: string
    configPresent: boolean
    readiness: {
      status: 'ready' | 'warning'
      issues: string[]
    }
  }
  llm: {
    defaultProvider: string
    defaultModel: string
    availableProviders: string[]
    readiness: {
      defaultProviderConfigured: boolean
      configuredProviderCount: number
      stageRoutingIssues: string[]
    }
    configuredProviders: Array<{
      provider: string
      configured: boolean
      baseUrl: string
      defaultModel: string
      isDefault: boolean
      usedByStages: string[]
    }>
    stageRouting: Array<{
      stage: string
      provider: string
      model: string
      providerConfigured: boolean
    }>
  }
}

type DoctorProjectSummary = {
  projectInitialized: boolean
  bookId?: string
  chapterCount: number
  operationLogDir: string
  infrastructure: DoctorInfrastructureView
  chapters: Array<{
    chapterId: string
    title: string
    status: string
    hasPlan: boolean
    hasDraft: boolean
    hasReview: boolean
    hasRewrite: boolean
    hasOutput: boolean
  }>
}

/**
 * `doctor` 命令域的查询装配层。
 */
export function loadDoctorProjectView(database: NovelDatabase): DoctorProjectSummary {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapters = chapterRepository.listByBookId(book.id)
  const llmStages: readonly LlmTaskStage[] = ['planning', 'generation', 'review', 'rewrite']

  return {
    projectInitialized: true,
    bookId: book.id,
    chapterCount: chapters.length,
    operationLogDir: resolveOperationLogDir(process.cwd()),
    infrastructure: buildDoctorInfrastructureView(database.client, llmStages),
    chapters: chapters.map((chapter) => ({
      chapterId: chapter.id,
      title: chapter.title,
      status: chapter.status,
      hasPlan: Boolean(planRepository.getLatestByChapterId(chapter.id)),
      hasDraft: Boolean(draftRepository.getLatestByChapterId(chapter.id)),
      hasReview: Boolean(reviewRepository.getLatestByChapterId(chapter.id)),
      hasRewrite: Boolean(rewriteRepository.getLatestByChapterId(chapter.id)),
      hasOutput: Boolean(outputRepository.getLatestByChapterId(chapter.id)),
    })),
  }
}

export async function loadDoctorProjectViewAsync(database: NovelDatabase): Promise<DoctorProjectSummary> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapters = await chapterRepository.listByBookIdAsync(book.id)
  const llmStages: readonly LlmTaskStage[] = ['planning', 'generation', 'review', 'rewrite']

  return {
    projectInitialized: true,
    bookId: book.id,
    chapterCount: chapters.length,
    operationLogDir: resolveOperationLogDir(process.cwd()),
    infrastructure: buildDoctorInfrastructureView(database.client, llmStages),
    chapters: await Promise.all(chapters.map(async (chapter) => ({
      chapterId: chapter.id,
      title: chapter.title,
      status: chapter.status,
      hasPlan: Boolean(await planRepository.getLatestByChapterIdAsync(chapter.id)),
      hasDraft: Boolean(await draftRepository.getLatestByChapterIdAsync(chapter.id)),
      hasReview: Boolean(await reviewRepository.getLatestByChapterIdAsync(chapter.id)),
      hasRewrite: Boolean(await rewriteRepository.getLatestByChapterIdAsync(chapter.id)),
      hasOutput: Boolean(await outputRepository.getLatestByChapterIdAsync(chapter.id)),
    }))),
  }
}

export function loadDoctorBootstrapView(): DoctorProjectSummary {
  const llmStages: readonly LlmTaskStage[] = ['planning', 'generation', 'review', 'rewrite']

  return {
    projectInitialized: false,
    chapterCount: 0,
    operationLogDir: resolveOperationLogDir(process.cwd()),
    infrastructure: buildDoctorInfrastructureView(readConfiguredBackend(), llmStages),
    chapters: [],
  }
}

export function loadDoctorChapterView(database: NovelDatabase, chapterId: string): {
  chapter: {
    id: string
    index: number
    title: string
    status: string
    currentPlanVersionId?: string
    currentVersionId?: string
  }
  workflowChain: {
    chapterId: string
    status: string
    currentPlanVersionId: string | null
    currentVersionId: string | null
    latestPlanId: string | null
    latestDraftId: string | null
    latestReviewId: string | null
    latestRewriteId: string | null
    latestOutputId: string | null
    operationLogDir: string
  }
} {
  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapter = chapterRepository.getById(chapterId)

  if (!chapter) {
    throw new NovelError(`Chapter not found: ${chapterId}`)
  }

  return {
    chapter,
    workflowChain: {
      chapterId: chapter.id,
      status: chapter.status,
      currentPlanVersionId: chapter.currentPlanVersionId ?? null,
      currentVersionId: chapter.currentVersionId ?? null,
      latestPlanId: planRepository.getLatestByChapterId(chapterId)?.versionId ?? null,
      latestDraftId: draftRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestReviewId: reviewRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestRewriteId: rewriteRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestOutputId: outputRepository.getLatestByChapterId(chapterId)?.id ?? null,
      operationLogDir: resolveOperationLogDir(process.cwd()),
    },
  }
}

export async function loadDoctorChapterViewAsync(database: NovelDatabase, chapterId: string): Promise<{
  chapter: {
    id: string
    index: number
    title: string
    status: string
    currentPlanVersionId?: string
    currentVersionId?: string
  }
  workflowChain: {
    chapterId: string
    status: string
    currentPlanVersionId: string | null
    currentVersionId: string | null
    latestPlanId: string | null
    latestDraftId: string | null
    latestReviewId: string | null
    latestRewriteId: string | null
    latestOutputId: string | null
    operationLogDir: string
  }
}> {
  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapter = await chapterRepository.getByIdAsync(chapterId)

  if (!chapter) {
    throw new NovelError(`Chapter not found: ${chapterId}`)
  }

  return {
    chapter,
    workflowChain: {
      chapterId: chapter.id,
      status: chapter.status,
      currentPlanVersionId: chapter.currentPlanVersionId ?? null,
      currentVersionId: chapter.currentVersionId ?? null,
      latestPlanId: (await planRepository.getLatestByChapterIdAsync(chapterId))?.versionId ?? null,
      latestDraftId: (await draftRepository.getLatestByChapterIdAsync(chapterId))?.id ?? null,
      latestReviewId: (await reviewRepository.getLatestByChapterIdAsync(chapterId))?.id ?? null,
      latestRewriteId: (await rewriteRepository.getLatestByChapterIdAsync(chapterId))?.id ?? null,
      latestOutputId: (await outputRepository.getLatestByChapterIdAsync(chapterId))?.id ?? null,
      operationLogDir: resolveOperationLogDir(process.cwd()),
    },
  }
}

function buildDoctorInfrastructureView(
  activeBackend: NovelDatabase['client'] | 'unconfigured',
  llmStages: readonly LlmTaskStage[],
): DoctorInfrastructureView {
  const env = readLlmEnv()
  const configPath = resolveProjectPaths(process.cwd()).databaseConfigPath
  const configuredProviders = [
    {
      provider: env.openAi.provider,
      configured: Boolean(env.openAi.apiKey),
      baseUrl: env.openAi.baseUrl,
      defaultModel: env.openAi.model,
      isDefault: env.provider === env.openAi.provider,
      usedByStages: [] as string[],
    },
    {
      provider: env.openAiCompatible.provider,
      configured: Boolean(env.openAiCompatible.apiKey),
      baseUrl: env.openAiCompatible.baseUrl,
      defaultModel: env.openAiCompatible.model,
      isDefault: env.provider === env.openAiCompatible.provider,
      usedByStages: [] as string[],
    },
  ]
  const configuredProviderMap = new Map(configuredProviders.map((item) => [item.provider, item.configured]))
  const stageRouting = llmStages.map((stage) => {
    const config = readLlmStageConfig(stage)

    const providerConfigured = configuredProviderMap.get(config.provider) ?? false

    const matchedProvider = configuredProviders.find((item) => item.provider === config.provider)
    if (matchedProvider) {
      matchedProvider.usedByStages.push(stage)
    }

    return {
      stage,
      provider: config.provider,
      model: config.model,
      providerConfigured,
    }
  })
  const databaseIssues = [
    ...(!existsSync(configPath) ? ['缺少项目数据库配置文件 config/database.json'] : []),
    ...(activeBackend === 'unconfigured' ? ['当前未识别到有效数据库 backend'] : []),
  ]
  const stageRoutingIssues = stageRouting
    .filter((item) => !item.providerConfigured)
    .map((item) => `阶段 ${item.stage} 当前路由到 provider=${item.provider}，但该 provider 未完成配置。`)
  const defaultProviderConfigured = configuredProviderMap.get(env.provider) ?? false

  return {
    database: {
      activeBackend,
      configPath,
      configPresent: existsSync(configPath),
      readiness: {
        status: databaseIssues.length === 0 ? 'ready' : 'warning',
        issues: databaseIssues,
      },
    },
    llm: {
      defaultProvider: env.provider,
      defaultModel: env.defaultModel,
      availableProviders: [
        ...(env.openAi.apiKey ? ['openai'] : []),
        ...(env.openAiCompatible.apiKey ? ['openai-compatible'] : []),
      ],
      readiness: {
        defaultProviderConfigured,
        configuredProviderCount: configuredProviders.filter((item) => item.configured).length,
        stageRoutingIssues,
      },
      configuredProviders,
      stageRouting,
    },
  }
}

function readConfiguredBackend(): NovelDatabase['client'] | 'unconfigured' {
  const configPath = resolveProjectPaths(process.cwd()).databaseConfigPath

  if (!existsSync(configPath)) {
    return 'unconfigured'
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as {
    database?: {
      client?: unknown
    }
  }

  return raw.database?.client === 'mysql' ? 'mysql' : 'sqlite'
}
