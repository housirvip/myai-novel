import { existsSync, readFileSync } from 'node:fs'

import type { NovelDatabase } from '../../../infra/db/database.js'
import { readLlmEnv, readLlmStageConfig } from '../../../shared/utils/env.js'
import { resolveProjectPaths } from '../../../shared/utils/project-paths.js'

import { loadDoctorVolumeViewAsync } from '../doctor/volume-services.js'
import { loadStateEndingViewAsync, loadStateThreadsViewAsync, loadStateVolumePlanViewAsync } from '../state/services.js'
import { loadWorkflowMissionViewAsync } from '../workflow-services.js'
import { BUILTIN_CASES, BUILTIN_VOLUME_CASES, type RegressionCaseName } from './cases.js'

type RegressionStepStatus = 'pass' | 'fail' | 'skip'
type RegressionArtifactStatus = 'ready' | 'missing'
export type RegressionResultStatus = 'pass' | 'warning' | 'missing-prerequisite' | 'unknown-case'

export type RegressionStep = {
  name: string
  status: RegressionStepStatus
  detail: string
}

export type RegressionArtifact = {
  name: string
  status: RegressionArtifactStatus
  detail: string
}

export type RegressionRunResult = {
  caseName: string
  targetId?: string
  known: boolean
  status: RegressionResultStatus
  summary: string
  steps: RegressionStep[]
  artifacts: RegressionArtifact[]
}

export type RegressionVolumeSuiteResult = {
  volumeId: string
  caseCount: number
  passedCount: number
  warningCount: number
  missingPrerequisiteCount: number
  results: RegressionRunResult[]
  summary: string
}

/**
 * `regression` 命令域的执行装配层。
 *
 * 它的职责不是直接调用业务主链，而是把一组“可重复运行的回归烟雾检查”收口成统一结果结构：
 * - 先判断 case 是否已注册
 * - 再判断该 case 是否依赖项目数据库或特定 target
 * - 最后把诊断结果统一折叠成 `RegressionRunResult`
 *
 * 这样 CLI、测试和后续 volume suite 都能复用同一套回归口径。
 */
export async function executeRegressionCase(
  database: NovelDatabase | null,
  caseName: string,
  targetId?: string,
): Promise<RegressionRunResult> {
  if (!BUILTIN_CASES.includes(caseName as RegressionCaseName)) {
    return {
      caseName,
      targetId,
      known: false,
      status: 'unknown-case',
      summary: `Unknown regression case: ${caseName}`,
      steps: [
        {
          name: 'resolve-case',
          status: 'fail',
          detail: 'Case name is not registered in BUILTIN_CASES.',
        },
      ],
      artifacts: [],
    }
  }

  switch (caseName as RegressionCaseName) {
    case 'llm-provider-smoke':
      return executeLlmProviderSmoke(targetId)
    case 'secondary-provider-smoke':
      return executeSecondaryProviderSmoke(targetId)
    case 'database-backend-smoke':
      return executeDatabaseBackendSmoke(database, targetId)
    case 'sqlite-backend-smoke':
      return executeDatabaseBackendSmoke(database, 'sqlite')
    case 'mysql-backend-smoke':
      return executeDatabaseBackendSmoke(database, 'mysql')
    case 'mixed-config-validation':
      return executeMixedConfigValidation()
    case 'volume-plan-smoke':
      if (!database) {
        return createProjectRequiredResult(caseName)
      }

      return await executeVolumePlanSmoke(database, targetId)
    case 'mission-carry-smoke':
      if (!database) {
        return createProjectRequiredResult(caseName)
      }

      return await executeMissionCarrySmoke(database, targetId)
    case 'thread-progression-smoke':
      if (!database) {
        return createProjectRequiredResult(caseName)
      }

      return await executeThreadProgressionSmoke(database, targetId)
    case 'ending-readiness-smoke':
      if (!database) {
        return createProjectRequiredResult(caseName)
      }

      return await executeEndingReadinessSmoke(database, targetId)
    case 'volume-doctor-smoke':
      if (!database) {
        return createProjectRequiredResult(caseName)
      }

      return await executeVolumeDoctorSmoke(database, targetId)
    case 'hook-pressure-smoke':
    case 'chapter-drop-safety':
    case 'review-layering-smoke':
      return createLegacySkeletonResult(caseName, targetId)
  }
}

function executeLlmProviderSmoke(targetId?: string): RegressionRunResult {
  const env = readLlmEnv()
  const availableProviders = [
    ...(env.openAi.apiKey ? ['openai'] : []),
    ...(env.openAiCompatible.apiKey ? ['openai-compatible'] : []),
  ]
  const targetProvider = targetId?.trim()
  const providerResolved = targetProvider ?? env.provider
  const providerAvailable = availableProviders.includes(providerResolved)
  const planning = readLlmStageConfig('planning', env)
  const generation = readLlmStageConfig('generation', env)
  const review = readLlmStageConfig('review', env)
  const rewrite = readLlmStageConfig('rewrite', env)

  return {
    caseName: 'llm-provider-smoke',
    targetId,
    known: true,
    status: providerAvailable ? 'pass' : 'warning',
    summary: providerAvailable
      ? `LLM provider is configured and available: ${providerResolved}.`
      : `LLM provider is not fully configured: ${providerResolved}.`,
    steps: [
      {
        name: 'resolve-default-provider',
        status: 'pass',
        detail: `default=${env.provider}; target=${providerResolved}`,
      },
      {
        name: 'check-provider-credentials',
        status: providerAvailable ? 'pass' : 'fail',
        detail: `availableProviders=${availableProviders.join(', ') || 'none'}`,
      },
      {
        name: 'resolve-stage-routing',
        status: 'pass',
        detail:
          `planning=${planning.provider}/${planning.model}; generation=${generation.provider}/${generation.model}; `
          + `review=${review.provider}/${review.model}; rewrite=${rewrite.provider}/${rewrite.model}`,
      },
    ],
    artifacts: [
      {
        name: '.env',
        status: providerAvailable ? 'ready' : 'missing',
        detail: 'Check `LLM_PROVIDER`, stage overrides, and provider credentials in your environment file.',
      },
      {
        name: 'doctor',
        status: 'ready',
        detail: 'Use `novel doctor` to inspect current provider and stage routing.',
      },
    ],
  }
}

function executeSecondaryProviderSmoke(targetId?: string): RegressionRunResult {
  const env = readLlmEnv()
  const availableProviders = [
    ...(env.openAi.apiKey ? ['openai'] : []),
    ...(env.openAiCompatible.apiKey ? ['openai-compatible'] : []),
  ]
  const secondaryProvider = targetId?.trim()
    || (env.provider === 'openai' ? 'openai-compatible' : 'openai')
  const secondaryConfigured = availableProviders.includes(secondaryProvider)
  const planning = readLlmStageConfig('planning', env)
  const generation = readLlmStageConfig('generation', env)
  const review = readLlmStageConfig('review', env)
  const rewrite = readLlmStageConfig('rewrite', env)
  const stagesUsingSecondary = [planning, generation, review, rewrite]
    .filter((item) => item.provider === secondaryProvider)
    .map((item) => item.stage)

  return {
    caseName: 'secondary-provider-smoke',
    targetId,
    known: true,
    status: secondaryConfigured ? 'pass' : 'warning',
    summary: secondaryConfigured
      ? `Secondary provider is configured and available: ${secondaryProvider}.`
      : `Secondary provider is not configured: ${secondaryProvider}.`,
    steps: [
      {
        name: 'resolve-secondary-provider',
        status: 'pass',
        detail: `default=${env.provider}; secondary=${secondaryProvider}`,
      },
      {
        name: 'check-secondary-credentials',
        status: secondaryConfigured ? 'pass' : 'fail',
        detail: `availableProviders=${availableProviders.join(', ') || 'none'}`,
      },
      {
        name: 'check-stage-usage',
        status: 'pass',
        detail: stagesUsingSecondary.length > 0
          ? `secondaryUsedByStages=${stagesUsingSecondary.join(', ')}`
          : 'No stage currently routes to the secondary provider; it remains standby capacity.',
      },
    ],
    artifacts: [
      {
        name: '.env',
        status: secondaryConfigured ? 'ready' : 'missing',
        detail: 'Configure the secondary provider credentials and model defaults in your environment file.',
      },
      {
        name: 'doctor',
        status: 'ready',
        detail: 'Use `novel doctor` to inspect default/secondary provider readiness and stage routing.',
      },
    ],
  }
}

function executeDatabaseBackendSmoke(database: NovelDatabase | null, targetId?: string): RegressionRunResult {
  const configuredBackend = readConfiguredBackend()

  if (!database && !configuredBackend) {
    return {
      caseName: 'database-backend-smoke',
      targetId,
      known: true,
      status: 'missing-prerequisite',
      summary: 'Project database config is missing. Initialize a project or create config/database.json first.',
      steps: [
        {
          name: 'resolve-project-config',
          status: 'fail',
          detail: `Missing database config: ${resolveProjectPaths(process.cwd()).databaseConfigPath}`,
        },
      ],
      artifacts: [
        {
          name: 'config/database.json',
          status: 'missing',
          detail: 'Run `novel init` or create the project database config before checking backend routing.',
        },
      ],
    }
  }

  const activeBackend = database?.client ?? configuredBackend ?? 'sqlite'
  const expectedBackend = targetId?.trim()
  const backendMatches = expectedBackend ? activeBackend === expectedBackend : true

  return {
    caseName: 'database-backend-smoke',
    targetId,
    known: true,
    status: backendMatches ? 'pass' : 'warning',
    summary: backendMatches
      ? `Database backend is active: ${activeBackend}.`
      : `Database backend mismatch: active=${activeBackend}, expected=${expectedBackend}.`,
    steps: [
      {
        name: 'detect-active-backend',
        status: 'pass',
        detail: database
          ? `activeBackend=${activeBackend}; source=runtime`
          : `activeBackend=${activeBackend}; source=config`,
      },
      {
        name: 'check-expected-backend',
        status: backendMatches ? 'pass' : 'fail',
        detail: expectedBackend ? `expectedBackend=${expectedBackend}` : 'No explicit backend target requested.',
      },
      {
        name: 'check-backend-readiness',
        status: database || configuredBackend ? 'pass' : 'fail',
        detail: database
          ? `Runtime database opened successfully with backend=${activeBackend}.`
          : `Backend=${activeBackend} resolved from project config. Runtime open was not attempted in projectless mode.`,
      },
    ],
    artifacts: [
      {
        name: 'config/database.json',
        status: 'ready',
        detail: 'Check the project database backend configuration.',
      },
      {
        name: 'doctor',
        status: 'ready',
        detail: 'Use `novel doctor` to inspect the active database backend.',
      },
    ],
  }
}

function executeMixedConfigValidation(): RegressionRunResult {
  const env = readLlmEnv()
  const configPath = resolveProjectPaths(process.cwd()).databaseConfigPath
  const defaultProviderConfigured = isProviderConfigured(env.provider, env)
  const stageRouting = [
    readLlmStageConfig('planning', env),
    readLlmStageConfig('generation', env),
    readLlmStageConfig('review', env),
    readLlmStageConfig('rewrite', env),
  ]
  const stageRoutingIssues = stageRouting
    .filter((item) => !isProviderConfigured(item.provider, env))
    .map((item) => `${item.stage} -> ${item.provider}/${item.model}`)
  const databaseValidation = validateProjectDatabaseConfig(configPath)
  const issues = [
    ...(!defaultProviderConfigured ? [`默认 provider 未完成配置：${env.provider}`] : []),
    ...stageRoutingIssues.map((item) => `阶段路由命中未配置 provider：${item}`),
    ...databaseValidation.issues,
  ]

  return {
    caseName: 'mixed-config-validation',
    known: true,
    status: issues.length === 0 ? 'pass' : 'warning',
    summary: issues.length === 0
      ? 'Environment provider config and project database config are mutually consistent.'
      : `Detected ${issues.length} mixed configuration issue(s) across env/database settings.`,
    steps: [
      {
        name: 'validate-default-provider',
        status: defaultProviderConfigured ? 'pass' : 'fail',
        detail: `defaultProvider=${env.provider}; configured=${String(defaultProviderConfigured)}`,
      },
      {
        name: 'validate-stage-routing',
        status: stageRoutingIssues.length === 0 ? 'pass' : 'fail',
        detail: stageRoutingIssues.length === 0
          ? 'All stage routes resolve to configured providers.'
          : stageRoutingIssues.join(' | '),
      },
      {
        name: 'validate-project-database-config',
        status: databaseValidation.status,
        detail: databaseValidation.detail,
      },
    ],
    artifacts: [
      {
        name: '.env',
        status: defaultProviderConfigured && stageRoutingIssues.length === 0 ? 'ready' : 'missing',
        detail: 'Check LLM_PROVIDER, stage overrides, and provider credentials.',
      },
      {
        name: 'config/database.json',
        status: databaseValidation.artifactStatus,
        detail: 'Check database backend selection and required backend fields.',
      },
      {
        name: 'doctor',
        status: 'ready',
        detail: 'Use `novel doctor` to inspect combined backend/provider readiness.',
      },
    ],
  }
}

function readConfiguredBackend(): NovelDatabase['client'] | null {
  const configPath = resolveProjectPaths(process.cwd()).databaseConfigPath

  if (!existsSync(configPath)) {
    return null
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as {
    database?: {
      client?: unknown
    }
  }

  return raw.database?.client === 'mysql' ? 'mysql' : 'sqlite'
}

function isProviderConfigured(provider: string, env: ReturnType<typeof readLlmEnv>): boolean {
  if (provider === 'openai-compatible') {
    return Boolean(env.openAiCompatible.apiKey)
  }

  return Boolean(env.openAi.apiKey)
}

function validateProjectDatabaseConfig(configPath: string): {
  status: RegressionStepStatus
  detail: string
  issues: string[]
  artifactStatus: RegressionArtifactStatus
} {
  if (!existsSync(configPath)) {
    return {
      status: 'skip',
      detail: 'Project database config is missing; skipped project-specific validation.',
      issues: [],
      artifactStatus: 'missing',
    }
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as {
      database?: Record<string, unknown>
    }
    const database = raw.database

    if (!database || typeof database !== 'object') {
      return {
        status: 'fail',
        detail: 'database field is missing from config/database.json.',
        issues: ['database field is missing from config/database.json'],
        artifactStatus: 'missing',
      }
    }

    const client = database.client

    if (client === 'sqlite') {
      const filename = database.filename
      const valid = typeof filename === 'string' && filename.trim().length > 0

      return {
        status: valid ? 'pass' : 'fail',
        detail: valid
          ? `SQLite config is valid: filename=${filename}`
          : 'SQLite config is invalid: filename is missing.',
        issues: valid ? [] : ['sqlite filename is missing in config/database.json'],
        artifactStatus: valid ? 'ready' : 'missing',
      }
    }

    if (client === 'mysql') {
      const requiredFields = ['host', 'port', 'user', 'database'] as const
      const missingFields = requiredFields.filter((field) => {
        const value = database[field]
        return field === 'port'
          ? !(typeof value === 'number' && Number.isInteger(value) && value > 0)
          : !(typeof value === 'string' && value.trim().length > 0)
      })

      return {
        status: missingFields.length === 0 ? 'pass' : 'fail',
        detail: missingFields.length === 0
          ? `MySQL config is valid: host=${String(database.host)}; database=${String(database.database)}`
          : `MySQL config is invalid: missing ${missingFields.join(', ')}`,
        issues: missingFields.map((field) => `mysql ${field} is missing in config/database.json`),
        artifactStatus: missingFields.length === 0 ? 'ready' : 'missing',
      }
    }

    return {
      status: 'fail',
      detail: 'database.client must be sqlite or mysql.',
      issues: ['database.client must be sqlite or mysql'],
      artifactStatus: 'missing',
    }
  } catch (error) {
    return {
      status: 'fail',
      detail: error instanceof Error ? `Invalid database config JSON: ${error.message}` : 'Invalid database config JSON.',
      issues: ['config/database.json is not valid JSON'],
      artifactStatus: 'missing',
    }
  }
}

export async function executeVolumeRegressionSuite(
  database: NovelDatabase,
  volumeId: string,
): Promise<RegressionVolumeSuiteResult> {
  const results = await Promise.all(BUILTIN_VOLUME_CASES.map((caseName) => executeRegressionCase(database, caseName, volumeId)))
  const passedCount = results.filter((item) => item.status === 'pass').length
  const warningCount = results.filter((item) => item.status === 'warning').length
  const missingPrerequisiteCount = results.filter((item) => item.status === 'missing-prerequisite').length

  return {
    volumeId,
    caseCount: results.length,
    passedCount,
    warningCount,
    missingPrerequisiteCount,
    results,
    summary:
      warningCount === 0 && missingPrerequisiteCount === 0
        ? `Volume regression suite passed for ${volumeId}.`
        : `Volume regression suite finished with ${warningCount} warning(s) and ${missingPrerequisiteCount} prerequisite issue(s).`,
  }
}

async function executeVolumePlanSmoke(database: NovelDatabase, volumeId?: string): Promise<RegressionRunResult> {
  if (!volumeId) {
    return createMissingPrerequisiteResult('volume-plan-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = await loadStateVolumePlanViewAsync(database, volumeId)
  const hasPlan = Boolean(view.latestVolumePlan)

  return {
    caseName: 'volume-plan-smoke',
    targetId: volumeId,
    known: true,
    status: hasPlan ? 'pass' : 'warning',
    summary: hasPlan ? 'Latest volume plan is available.' : 'Volume exists, but latest volume plan is missing.',
    steps: [
      { name: 'load-volume', status: 'pass', detail: `Volume loaded: ${view.volume.id}` },
      {
        name: 'load-latest-volume-plan',
        status: hasPlan ? 'pass' : 'fail',
        detail: hasPlan ? 'Latest volume plan found.' : 'Latest volume plan not found.',
      },
    ],
    artifacts: [
      {
        name: 'state volume-plan',
        status: hasPlan ? 'ready' : 'missing',
        detail: 'Use `novel state volume-plan <volumeId>` to inspect the latest volume plan.',
      },
      {
        name: 'plan volume-show',
        status: hasPlan ? 'ready' : 'missing',
        detail: 'Use `novel plan volume-show <volumeId>` to inspect the rolling window plan detail.',
      },
    ],
  }
}

async function executeMissionCarrySmoke(database: NovelDatabase, chapterId?: string): Promise<RegressionRunResult> {
  if (!chapterId) {
    return createMissingPrerequisiteResult('mission-carry-smoke', 'chapterId', 'This case requires a chapter id.')
  }

  const view = await loadWorkflowMissionViewAsync(database, chapterId)
  const hasVolumePlan = Boolean(view.volumePlan)
  const hasMission = Boolean(view.mission)

  return {
    caseName: 'mission-carry-smoke',
    targetId: chapterId,
    known: true,
    status: hasVolumePlan && hasMission ? 'pass' : 'warning',
    summary:
      hasVolumePlan && hasMission
        ? 'Chapter mission is available and attached to the latest volume plan.'
        : 'Mission carry chain is incomplete for the target chapter.',
    steps: [
      { name: 'load-chapter', status: 'pass', detail: `Chapter loaded: ${view.chapter.id}` },
      {
        name: 'load-volume-plan',
        status: hasVolumePlan ? 'pass' : 'fail',
        detail: hasVolumePlan ? 'Volume plan found.' : 'No volume plan found for the chapter volume.',
      },
      {
        name: 'load-chapter-mission',
        status: hasMission ? 'pass' : 'fail',
        detail: hasMission ? 'Current chapter mission found.' : 'Current chapter mission not found in latest volume plan.',
      },
    ],
    artifacts: [
      {
        name: 'plan mission-show',
        status: hasMission ? 'ready' : 'missing',
        detail: 'Use `novel plan mission-show <chapterId>` to inspect the mission payload.',
      },
      {
        name: 'plan volume-show',
        status: hasVolumePlan ? 'ready' : 'missing',
        detail: 'Use `novel plan volume-show <volumeId>` to inspect the parent volume plan.',
      },
    ],
  }
}

async function executeThreadProgressionSmoke(database: NovelDatabase, volumeId?: string): Promise<RegressionRunResult> {
  if (!volumeId) {
    return createMissingPrerequisiteResult('thread-progression-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = await loadStateThreadsViewAsync(database, volumeId)
  const activeThreadCount = view.activeThreads.length
  const recentProgressCount = view.recentProgress.length

  return {
    caseName: 'thread-progression-smoke',
    targetId: volumeId,
    known: true,
    status: activeThreadCount > 0 && recentProgressCount > 0 ? 'pass' : 'warning',
    summary:
      activeThreadCount > 0 && recentProgressCount > 0
        ? 'Thread focus and recent progress are both visible.'
        : 'Thread progression chain is visible but incomplete.',
    steps: [
      {
        name: 'load-active-threads',
        status: activeThreadCount > 0 ? 'pass' : 'fail',
        detail: `Active thread count: ${activeThreadCount}`,
      },
      {
        name: 'load-recent-progress',
        status: recentProgressCount > 0 ? 'pass' : 'fail',
        detail: `Recent progress count: ${recentProgressCount}`,
      },
    ],
    artifacts: [
      {
        name: 'state threads',
        status: activeThreadCount > 0 ? 'ready' : 'missing',
        detail: 'Use `novel state threads <volumeId>` to inspect thread state.',
      },
      {
        name: 'review volume',
        status: activeThreadCount > 0 ? 'ready' : 'missing',
        detail: 'Use `novel review volume <volumeId>` to inspect volume review summary.',
      },
    ],
  }
}

async function executeEndingReadinessSmoke(database: NovelDatabase, targetId?: string): Promise<RegressionRunResult> {
  const view = await loadStateEndingViewAsync(database)
  const endingReadiness = view.endingReadiness as { targetVolumeId?: string } | null
  const hasEndingReadiness = Boolean(endingReadiness)
  const targetMatches = targetId ? endingReadiness?.targetVolumeId === targetId : hasEndingReadiness

  return {
    caseName: 'ending-readiness-smoke',
    targetId,
    known: true,
    status: hasEndingReadiness && targetMatches ? 'pass' : 'warning',
    summary:
      hasEndingReadiness && targetMatches
        ? 'Ending readiness is available and aligned with the target volume.'
        : 'Ending readiness exists but still needs manual verification or target alignment.',
    steps: [
      {
        name: 'load-ending-readiness',
        status: hasEndingReadiness ? 'pass' : 'fail',
        detail: hasEndingReadiness ? 'Ending readiness snapshot found.' : 'Ending readiness snapshot not found.',
      },
      {
        name: 'check-target-alignment',
        status: targetMatches ? 'pass' : 'fail',
        detail: targetId ? `Target volume match: ${String(targetMatches)}` : 'No explicit volume target requested.',
      },
    ],
    artifacts: [
      {
        name: 'state ending',
        status: hasEndingReadiness ? 'ready' : 'missing',
        detail: 'Use `novel state ending` to inspect ending readiness.',
      },
      {
        name: 'snapshot volume',
        status: targetId ? 'ready' : 'missing',
        detail: 'Use `novel snapshot volume <volumeId>` to preserve the current volume snapshot.',
      },
    ],
  }
}

async function executeVolumeDoctorSmoke(database: NovelDatabase, volumeId?: string): Promise<RegressionRunResult> {
  if (!volumeId) {
    return createMissingPrerequisiteResult('volume-doctor-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = await loadDoctorVolumeViewAsync(database, volumeId)
  const diagnostics = view.diagnostics
  const hasCriticalRisk =
    diagnostics.missionChainGapCount > 0 ||
    diagnostics.stalledThreadCount > 0 ||
    diagnostics.closureGapCount > 0

  return {
    caseName: 'volume-doctor-smoke',
    targetId: volumeId,
    known: true,
    status: hasCriticalRisk ? 'warning' : 'pass',
    summary: hasCriticalRisk
      ? 'Volume doctor detected one or more elevated volume-level risks.'
      : 'Volume doctor finished without elevated volume-level risk signals.',
    steps: [
      {
        name: 'load-volume-diagnostics',
        status: 'pass',
        detail: `Chapter count=${diagnostics.chapterCount}; thread count=${diagnostics.threadCount}`,
      },
      {
        name: 'check-critical-risks',
        status: hasCriticalRisk ? 'fail' : 'pass',
        detail:
          `stalledThreadCount=${diagnostics.stalledThreadCount}; closureGapCount=${diagnostics.closureGapCount}; missionChainGapCount=${diagnostics.missionChainGapCount}`,
      },
    ],
    artifacts: [
      {
        name: 'doctor volume',
        status: 'ready',
        detail: 'Use `novel doctor volume <volumeId>` to inspect detailed diagnostics.',
      },
      {
        name: 'snapshot volume',
        status: 'ready',
        detail: 'Use `novel snapshot volume <volumeId>` to preserve a matching snapshot for diagnosis.',
      },
    ],
  }
}

function createLegacySkeletonResult(caseName: string, targetId?: string): RegressionRunResult {
  return {
    caseName,
    targetId,
    known: true,
    status: 'warning',
    summary: `Legacy regression case ${caseName} is still reserved and has not been upgraded in v4.1 yet.`,
    steps: [
      {
        name: 'resolve-case',
        status: 'skip',
        detail: 'Case name is registered, but executor logic is not implemented yet.',
      },
    ],
    artifacts: [],
  }
}

function createMissingPrerequisiteResult(
  caseName: string,
  expectedTarget: string,
  detail: string,
): RegressionRunResult {
  return {
    caseName,
    known: true,
    status: 'missing-prerequisite',
    summary: detail,
    steps: [
      {
        name: 'resolve-target',
        status: 'fail',
        detail: `Expected ${expectedTarget} argument is missing.`,
      },
    ],
    artifacts: [],
  }
}

function createProjectRequiredResult(caseName: string): RegressionRunResult {
  return {
    caseName,
    known: true,
    status: 'missing-prerequisite',
    summary: 'This regression case requires an initialized project database.',
    steps: [
      {
        name: 'open-project-database',
        status: 'fail',
        detail: 'Run `novel init` in the target directory before executing this case.',
      },
    ],
    artifacts: [
      {
        name: 'config/database.json',
        status: 'missing',
        detail: 'Project database config is required for workflow/state regression cases.',
      },
    ],
  }
}
