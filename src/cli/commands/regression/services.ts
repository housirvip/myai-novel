import type { NovelDatabase } from '../../../infra/db/database.js'

import { loadDoctorVolumeView } from '../doctor/volume-services.js'
import { loadStateEndingView, loadStateThreadsView, loadStateVolumePlanView } from '../state/services.js'
import { loadWorkflowMissionView } from '../workflow-services.js'
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

export function executeRegressionCase(
  database: NovelDatabase,
  caseName: string,
  targetId?: string,
): RegressionRunResult {
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
    case 'volume-plan-smoke':
      return executeVolumePlanSmoke(database, targetId)
    case 'mission-carry-smoke':
      return executeMissionCarrySmoke(database, targetId)
    case 'thread-progression-smoke':
      return executeThreadProgressionSmoke(database, targetId)
    case 'ending-readiness-smoke':
      return executeEndingReadinessSmoke(database, targetId)
    case 'volume-doctor-smoke':
      return executeVolumeDoctorSmoke(database, targetId)
    case 'hook-pressure-smoke':
    case 'chapter-drop-safety':
    case 'review-layering-smoke':
      return createLegacySkeletonResult(caseName, targetId)
  }
}

export function executeVolumeRegressionSuite(
  database: NovelDatabase,
  volumeId: string,
): RegressionVolumeSuiteResult {
  const results = BUILTIN_VOLUME_CASES.map((caseName) => executeRegressionCase(database, caseName, volumeId))
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

function executeVolumePlanSmoke(database: NovelDatabase, volumeId?: string): RegressionRunResult {
  if (!volumeId) {
    return createMissingPrerequisiteResult('volume-plan-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = loadStateVolumePlanView(database, volumeId)
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

function executeMissionCarrySmoke(database: NovelDatabase, chapterId?: string): RegressionRunResult {
  if (!chapterId) {
    return createMissingPrerequisiteResult('mission-carry-smoke', 'chapterId', 'This case requires a chapter id.')
  }

  const view = loadWorkflowMissionView(database, chapterId)
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

function executeThreadProgressionSmoke(database: NovelDatabase, volumeId?: string): RegressionRunResult {
  if (!volumeId) {
    return createMissingPrerequisiteResult('thread-progression-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = loadStateThreadsView(database, volumeId)
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

function executeEndingReadinessSmoke(database: NovelDatabase, targetId?: string): RegressionRunResult {
  const view = loadStateEndingView(database)
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

function executeVolumeDoctorSmoke(database: NovelDatabase, volumeId?: string): RegressionRunResult {
  if (!volumeId) {
    return createMissingPrerequisiteResult('volume-doctor-smoke', 'volumeId', 'This case requires a volume id.')
  }

  const view = loadDoctorVolumeView(database, volumeId)
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
