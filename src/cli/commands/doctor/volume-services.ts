import type { StoryThread } from '../../../shared/types/domain.js'
import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { EndingReadinessRepository } from '../../../infra/repository/ending-readiness-repository.js'
import { StoryThreadProgressRepository } from '../../../infra/repository/story-thread-progress-repository.js'
import { StoryThreadRepository } from '../../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { VolumeRepository } from '../../../infra/repository/volume-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

export type DoctorVolumeRiskLevel = 'low' | 'medium' | 'high'

export type DoctorVolumeRisk = {
  level: DoctorVolumeRiskLevel
  code: string
  summary: string
  detail: string
  relatedIds: string[]
}

export type DoctorVolumeView = {
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  diagnostics: {
    chapterCount: number
    finalizedOutputCount: number
    hasVolumePlan: boolean
    threadCount: number
    endingTargetMatches: boolean
    stalledThreadCount: number
    closureGapCount: number
    neglectedThreadCount: number
    unfinishedChapterCount: number
    missionChainGapCount: number
    ensembleRiskCount: number
    pendingPayoffPressure: number
    highRiskCount: number
    mediumRiskCount: number
  }
  overview: {
    overallLevel: DoctorVolumeRiskLevel
    summary: string
  }
  missionRisks: DoctorVolumeRisk[]
  threadRisks: DoctorVolumeRisk[]
  endingRisks: DoctorVolumeRisk[]
  chapterRisks: DoctorVolumeRisk[]
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
    hasOutput: boolean
  }>
}

export function loadDoctorVolumeView(database: NovelDatabase, volumeId: string): DoctorVolumeView {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = new VolumeRepository(database).getById(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapterRepository = new ChapterRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapters = chapterRepository
    .listByBookId(book.id)
    .filter((chapter) => chapter.volumeId === volumeId)
    .map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
      hasOutput: Boolean(outputRepository.getLatestByChapterId(chapter.id)),
    }))
  const chapterIds = chapters.map((chapter) => chapter.id)
  const chapterIdSet = new Set(chapterIds)
  const chapterIndexes = chapters.map((chapter) => chapter.index)
  const minChapterIndex = chapterIndexes.length > 0 ? Math.min(...chapterIndexes) : undefined
  const maxChapterIndex = chapterIndexes.length > 0 ? Math.max(...chapterIndexes) : undefined

  const endingReadiness = new EndingReadinessRepository(database).getByBookId(book.id)
  const volumePlan = new VolumePlanRepository(database).getLatestByVolumeId(volumeId)
  const storyThreads = new StoryThreadRepository(database).listByVolumeId(volumeId)
  const threadProgress = new StoryThreadProgressRepository(database).listByBookId(book.id)
  const threadProgressByThreadId = new Map<string, typeof threadProgress>()

  for (const progress of threadProgress) {
    const existing = threadProgressByThreadId.get(progress.threadId) ?? []
    existing.push(progress)
    threadProgressByThreadId.set(progress.threadId, existing)
  }

  const missionRisks = buildMissionRisks({
    volumeId,
    chapterIds,
    chapterIdSet,
    minChapterIndex,
    maxChapterIndex,
    volumePlan,
  })
  const threadRisks = buildThreadRisks({
    storyThreads,
    threadProgressByThreadId,
    chapterIds,
    chapterCount: chapters.length,
  })
  const endingRisks = buildEndingRisks({
    volumeId,
    endingReadiness,
    maxChapterIndex,
  })
  const chapterRisks = buildChapterRisks({
    chapters,
    volumePlan,
  })

  const stalledThreadCount = threadRisks.filter((risk) => risk.code === 'thread-stalled').length
  const neglectedThreadIds = (endingReadiness?.closureGaps ?? [])
    .map((gap) => gap.relatedThreadId)
    .filter((threadId): threadId is string => Boolean(threadId))
    .filter((threadId, index, values) => values.indexOf(threadId) === index)
  const unfinishedChapterCount = chapters.filter((chapter) => chapter.status !== 'finalized').length
  const missionChainGapCount = missionRisks.length
  const ensembleRiskCount = threadRisks.filter((risk) => risk.code.startsWith('ensemble-')).length
  const pendingPayoffPressure = (endingReadiness?.pendingPayoffs ?? []).filter((payoff) => payoff.status === 'pending').length
  const allRisks = [...missionRisks, ...threadRisks, ...endingRisks, ...chapterRisks]
  const highRiskCount = allRisks.filter((risk) => risk.level === 'high').length
  const mediumRiskCount = allRisks.filter((risk) => risk.level === 'medium').length

  return {
    volume,
    diagnostics: {
      chapterCount: chapters.length,
      finalizedOutputCount: chapters.filter((chapter) => chapter.hasOutput).length,
      hasVolumePlan: Boolean(volumePlan),
      threadCount: storyThreads.length,
      endingTargetMatches: endingReadiness?.targetVolumeId === volumeId,
      stalledThreadCount,
      closureGapCount: endingReadiness?.closureGaps.length ?? 0,
      neglectedThreadCount: neglectedThreadIds.length,
      unfinishedChapterCount,
      missionChainGapCount,
      ensembleRiskCount,
      pendingPayoffPressure,
      highRiskCount,
      mediumRiskCount,
    },
    overview: buildOverview(allRisks),
    missionRisks,
    threadRisks,
    endingRisks,
    chapterRisks,
    chapters,
  }
}

export async function loadDoctorVolumeViewAsync(database: NovelDatabase, volumeId: string): Promise<DoctorVolumeView> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = await new VolumeRepository(database).getByIdAsync(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapterRepository = new ChapterRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapterRows = await chapterRepository.listByBookIdAsync(book.id)
  const chapters = await Promise.all(
    chapterRows
      .filter((chapter) => chapter.volumeId === volumeId)
      .map(async (chapter) => ({
        id: chapter.id,
        index: chapter.index,
        title: chapter.title,
        status: chapter.status,
        hasOutput: Boolean(await outputRepository.getLatestByChapterIdAsync(chapter.id)),
      })),
  )
  const chapterIds = chapters.map((chapter) => chapter.id)
  const chapterIdSet = new Set(chapterIds)
  const chapterIndexes = chapters.map((chapter) => chapter.index)
  const minChapterIndex = chapterIndexes.length > 0 ? Math.min(...chapterIndexes) : undefined
  const maxChapterIndex = chapterIndexes.length > 0 ? Math.max(...chapterIndexes) : undefined

  const endingReadiness = await new EndingReadinessRepository(database).getByBookIdAsync(book.id)
  const volumePlan = await new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId)
  const storyThreads = await new StoryThreadRepository(database).listByVolumeIdAsync(volumeId)
  const threadProgress = await new StoryThreadProgressRepository(database).listByBookIdAsync(book.id)
  const threadProgressByThreadId = new Map<string, typeof threadProgress>()

  for (const progress of threadProgress) {
    const existing = threadProgressByThreadId.get(progress.threadId) ?? []
    existing.push(progress)
    threadProgressByThreadId.set(progress.threadId, existing)
  }

  const missionRisks = buildMissionRisks({
    volumeId,
    chapterIds,
    chapterIdSet,
    minChapterIndex,
    maxChapterIndex,
    volumePlan,
  })
  const threadRisks = buildThreadRisks({
    storyThreads,
    threadProgressByThreadId,
    chapterIds,
    chapterCount: chapters.length,
  })
  const endingRisks = buildEndingRisks({
    volumeId,
    endingReadiness,
    maxChapterIndex,
  })
  const chapterRisks = buildChapterRisks({
    chapters,
    volumePlan,
  })

  const stalledThreadCount = threadRisks.filter((risk) => risk.code === 'thread-stalled').length
  const neglectedThreadIds = (endingReadiness?.closureGaps ?? [])
    .map((gap) => gap.relatedThreadId)
    .filter((threadId): threadId is string => Boolean(threadId))
    .filter((threadId, index, values) => values.indexOf(threadId) === index)
  const unfinishedChapterCount = chapters.filter((chapter) => chapter.status !== 'finalized').length
  const missionChainGapCount = missionRisks.length
  const ensembleRiskCount = threadRisks.filter((risk) => risk.code.startsWith('ensemble-')).length
  const pendingPayoffPressure = (endingReadiness?.pendingPayoffs ?? []).filter((payoff) => payoff.status === 'pending').length
  const allRisks = [...missionRisks, ...threadRisks, ...endingRisks, ...chapterRisks]
  const highRiskCount = allRisks.filter((risk) => risk.level === 'high').length
  const mediumRiskCount = allRisks.filter((risk) => risk.level === 'medium').length

  return {
    volume,
    diagnostics: {
      chapterCount: chapters.length,
      finalizedOutputCount: chapters.filter((chapter) => chapter.hasOutput).length,
      hasVolumePlan: Boolean(volumePlan),
      threadCount: storyThreads.length,
      endingTargetMatches: endingReadiness?.targetVolumeId === volumeId,
      stalledThreadCount,
      closureGapCount: endingReadiness?.closureGaps.length ?? 0,
      neglectedThreadCount: neglectedThreadIds.length,
      unfinishedChapterCount,
      missionChainGapCount,
      ensembleRiskCount,
      pendingPayoffPressure,
      highRiskCount,
      mediumRiskCount,
    },
    overview: buildOverview(allRisks),
    missionRisks,
    threadRisks,
    endingRisks,
    chapterRisks,
    chapters,
  }
}

type BuildMissionRisksInput = {
  volumeId: string
  chapterIds: string[]
  chapterIdSet: Set<string>
  minChapterIndex?: number
  maxChapterIndex?: number
  volumePlan: ReturnType<VolumePlanRepository['getLatestByVolumeId']>
}

function buildMissionRisks(input: BuildMissionRisksInput): DoctorVolumeRisk[] {
  const risks: DoctorVolumeRisk[] = []

  if (!input.volumePlan) {
    risks.push({
      level: 'high',
      code: 'mission-missing-plan',
      summary: '当前卷缺少 volume plan，mission 链不可验证。',
      detail: `卷 ${input.volumeId} 还没有最新的 volume window 规划。`,
      relatedIds: [input.volumeId],
    })
    return risks
  }

  const missingChapterLinks = input.volumePlan.chapterMissions.filter((mission) => !input.chapterIdSet.has(mission.chapterId))
  for (const mission of missingChapterLinks) {
    risks.push({
      level: 'high',
      code: 'mission-missing-chapter',
      summary: `mission ${mission.id} 指向不存在的卷内章节。`,
      detail: `mission 绑定 chapterId=${mission.chapterId}，但该章节不在当前卷章节集合中。`,
      relatedIds: [mission.id, mission.chapterId, mission.threadId],
    })
  }

  const windowMismatches = input.volumePlan.chapterMissions.filter((mission) => {
    const chapterIndex = resolveMissionChapterIndex(mission.chapterId, input.chapterIds, input.minChapterIndex)
    if (chapterIndex === undefined) {
      return false
    }

    return (
      chapterIndex < input.volumePlan!.rollingWindow.windowStartChapterIndex ||
      chapterIndex > input.volumePlan!.rollingWindow.windowEndChapterIndex
    )
  })
  for (const mission of windowMismatches) {
    risks.push({
      level: 'medium',
      code: 'mission-window-mismatch',
      summary: `mission ${mission.id} 超出当前 rolling window。`,
      detail: `mission 绑定章节 ${mission.chapterId} 不在 window ${input.volumePlan.rollingWindow.windowStartChapterIndex}-${input.volumePlan.rollingWindow.windowEndChapterIndex} 内。`,
      relatedIds: [mission.id, mission.chapterId, mission.threadId],
    })
  }

  const coveredChapterIds = new Set(input.volumePlan.chapterMissions.map((mission) => mission.chapterId))
  const uncoveredChapterIds = input.chapterIds.filter((chapterId) => !coveredChapterIds.has(chapterId))
  if (uncoveredChapterIds.length > 0) {
    risks.push({
      level: uncoveredChapterIds.length >= 2 ? 'high' : 'medium',
      code: 'mission-uncovered-chapters',
      summary: '当前卷存在未被 mission 覆盖的章节。',
      detail: `未覆盖章节数=${uncoveredChapterIds.length}。`,
      relatedIds: uncoveredChapterIds,
    })
  }

  if (
    input.minChapterIndex !== undefined &&
    input.maxChapterIndex !== undefined &&
    (input.volumePlan.rollingWindow.windowStartChapterIndex > input.maxChapterIndex ||
      input.volumePlan.rollingWindow.windowEndChapterIndex < input.minChapterIndex)
  ) {
    risks.push({
      level: 'high',
      code: 'mission-window-detached',
      summary: 'volume plan 的 rolling window 与当前卷章节区间脱节。',
      detail: `当前卷章节区间=${input.minChapterIndex}-${input.maxChapterIndex}，window=${input.volumePlan.rollingWindow.windowStartChapterIndex}-${input.volumePlan.rollingWindow.windowEndChapterIndex}。`,
      relatedIds: [input.volumePlan.id, input.volumeId],
    })
  }

  return risks
}

type BuildThreadRisksInput = {
  storyThreads: StoryThread[]
  threadProgressByThreadId: Map<string, Array<{ chapterId: string; progressStatus: string }>>
  chapterIds: string[]
  chapterCount: number
}

function buildThreadRisks(input: BuildThreadRisksInput): DoctorVolumeRisk[] {
  const risks: DoctorVolumeRisk[] = []
  const activeThreads = input.storyThreads.filter((thread) => thread.status === 'active')

  for (const thread of activeThreads) {
    const progresses = input.threadProgressByThreadId.get(thread.id) ?? []
    const inVolumeProgresses = progresses.filter((progress) => input.chapterIds.includes(progress.chapterId))
    const latestProgress = inVolumeProgresses[0] ?? progresses[0]
    const stalledByStage = (thread.priority === 'high' || thread.priority === 'critical') && (thread.stage === 'setup' || thread.stage === 'developing')
    const missingProgress = inVolumeProgresses.length === 0
    const stalledProgress = latestProgress?.progressStatus === 'setup' || latestProgress?.progressStatus === 'stalled'

    if (stalledByStage && (missingProgress || stalledProgress)) {
      risks.push({
        level: thread.priority === 'critical' ? 'high' : 'medium',
        code: 'thread-stalled',
        summary: `线程 ${thread.title} 长期停滞在低阶段。`,
        detail: `priority=${thread.priority}，stage=${thread.stage}，卷内 progress 数=${inVolumeProgresses.length}。`,
        relatedIds: [thread.id, ...(latestProgress ? [latestProgress.chapterId] : [])],
      })
    }

    if (missingProgress) {
      risks.push({
        level: thread.priority === 'critical' || thread.priority === 'high' ? 'high' : 'medium',
        code: 'thread-missing-progress',
        summary: `线程 ${thread.title} 在当前卷缺少 progress 更新。`,
        detail: `当前卷章节数=${input.chapterCount}，但未找到该线程对应的推进记录。`,
        relatedIds: [thread.id],
      })
    }
  }

  const ensembleThreads = activeThreads.filter((thread) => thread.threadType === 'character' || thread.threadType === 'relationship')
  const neglectedEnsembleThreads = ensembleThreads.filter((thread) => {
    const progresses = input.threadProgressByThreadId.get(thread.id) ?? []
    const inVolumeProgresses = progresses.filter((progress) => input.chapterIds.includes(progress.chapterId))
    return inVolumeProgresses.length === 0 || inVolumeProgresses.every((progress) => progress.progressStatus === 'setup' || progress.progressStatus === 'stalled')
  })

  if (neglectedEnsembleThreads.length > 0) {
    risks.push({
      level: neglectedEnsembleThreads.length >= 2 ? 'high' : 'medium',
      code: 'ensemble-thread-neglected',
      summary: '人物线/关系线存在长期未推进的群像失衡风险。',
      detail: `受影响线程数=${neglectedEnsembleThreads.length}。`,
      relatedIds: neglectedEnsembleThreads.map((thread) => thread.id),
    })
  }

  const neglectedSubplots = activeThreads.filter((thread) => thread.threadType === 'subplot' && (thread.priority === 'high' || thread.priority === 'critical')).filter((thread) => {
    const progresses = input.threadProgressByThreadId.get(thread.id) ?? []
    return !progresses.some((progress) => input.chapterIds.includes(progress.chapterId))
  })

  if (neglectedSubplots.length > 0) {
    risks.push({
      level: 'high',
      code: 'ensemble-subplot-carry-missing',
      summary: '高优先级支线长期未在当前卷兑现承接。',
      detail: `缺失承接支线数=${neglectedSubplots.length}。`,
      relatedIds: neglectedSubplots.map((thread) => thread.id),
    })
  }

  return risks
}

type BuildEndingRisksInput = {
  volumeId: string
  endingReadiness: ReturnType<EndingReadinessRepository['getByBookId']>
  maxChapterIndex?: number
}

function buildEndingRisks(input: BuildEndingRisksInput): DoctorVolumeRisk[] {
  const risks: DoctorVolumeRisk[] = []

  if (!input.endingReadiness) {
    risks.push({
      level: 'high',
      code: 'ending-missing-readiness',
      summary: '缺少 ending readiness 快照，终局风险不可判断。',
      detail: '当前项目还没有生成 ending_readiness_current 记录。',
      relatedIds: [input.volumeId],
    })
    return risks
  }

  if (input.endingReadiness.targetVolumeId !== input.volumeId) {
    risks.push({
      level: 'medium',
      code: 'ending-target-mismatch',
      summary: 'ending readiness 的目标卷与当前卷不一致。',
      detail: `targetVolumeId=${input.endingReadiness.targetVolumeId}，当前 volumeId=${input.volumeId}。`,
      relatedIds: [input.endingReadiness.targetVolumeId, input.volumeId],
    })
  }

  const severeClosureGaps = input.endingReadiness.closureGaps.filter((gap) => gap.severity === 'high')
  if (severeClosureGaps.length > 0) {
    risks.push({
      level: 'high',
      code: 'ending-closure-gap',
      summary: '存在高危 closure gaps，终局收束压力过高。',
      detail: `高危缺口数=${severeClosureGaps.length}。`,
      relatedIds: severeClosureGaps.map((gap) => gap.relatedThreadId).filter((value): value is string => Boolean(value)),
    })
  }

  const overduePendingPayoffs = input.endingReadiness.pendingPayoffs.filter((payoff) => {
    if (payoff.status !== 'pending') {
      return false
    }

    if (input.maxChapterIndex === undefined || payoff.targetChapterIndex === undefined) {
      return true
    }

    return payoff.targetChapterIndex <= input.maxChapterIndex + 1
  })
  if (overduePendingPayoffs.length > 0) {
    risks.push({
      level: overduePendingPayoffs.length >= 2 ? 'high' : 'medium',
      code: 'ending-pending-payoff-pressure',
      summary: 'pending payoff 压力较高，当前卷需要提前回收。',
      detail: `待回收 payoff 数=${overduePendingPayoffs.length}。`,
      relatedIds: overduePendingPayoffs.map((payoff) => payoff.relatedThreadId).filter((value): value is string => Boolean(value)),
    })
  }

  const missingPrerequisites = input.endingReadiness.finalConflictPrerequisites.filter((item) => item.status !== 'ready')
  if (missingPrerequisites.length > 0) {
    risks.push({
      level: missingPrerequisites.some((item) => item.status === 'missing') ? 'high' : 'medium',
      code: 'ending-final-conflict-prerequisite',
      summary: '终局前提仍未准备齐。',
      detail: `未 ready 的 final conflict prerequisite 数=${missingPrerequisites.length}。`,
      relatedIds: missingPrerequisites.map((item) => item.relatedThreadId).filter((value): value is string => Boolean(value)),
    })
  }

  return risks
}

type BuildChapterRisksInput = {
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
    hasOutput: boolean
  }>
  volumePlan: ReturnType<VolumePlanRepository['getLatestByVolumeId']>
}

function buildChapterRisks(input: BuildChapterRisksInput): DoctorVolumeRisk[] {
  const risks: DoctorVolumeRisk[] = []
  const missingOutputs = input.chapters.filter((chapter) => chapter.status === 'finalized' && !chapter.hasOutput)

  if (missingOutputs.length > 0) {
    risks.push({
      level: 'high',
      code: 'chapter-finalized-without-output',
      summary: '存在已 finalized 但没有 chapter output 的章节。',
      detail: `异常章节数=${missingOutputs.length}。`,
      relatedIds: missingOutputs.map((chapter) => chapter.id),
    })
  }

  const unfinishedWithMission = input.volumePlan
    ? input.chapters.filter((chapter) => chapter.status !== 'finalized' && input.volumePlan!.chapterMissions.some((mission) => mission.chapterId === chapter.id))
    : []

  if (unfinishedWithMission.length > 0) {
    risks.push({
      level: unfinishedWithMission.length >= 2 ? 'medium' : 'low',
      code: 'chapter-mission-not-finished',
      summary: '已有 mission 的章节仍未 finalized。',
      detail: `未完结但已被纳入 mission 的章节数=${unfinishedWithMission.length}。`,
      relatedIds: unfinishedWithMission.map((chapter) => chapter.id),
    })
  }

  return risks
}

function buildOverview(risks: DoctorVolumeRisk[]): { overallLevel: DoctorVolumeRiskLevel; summary: string } {
  const highRiskCount = risks.filter((risk) => risk.level === 'high').length
  const mediumRiskCount = risks.filter((risk) => risk.level === 'medium').length

  if (highRiskCount > 0) {
    return {
      overallLevel: 'high',
      summary: `当前卷存在 ${highRiskCount} 个高风险信号，优先处理 mission / thread / ending 断点。`,
    }
  }

  if (mediumRiskCount > 0) {
    return {
      overallLevel: 'medium',
      summary: `当前卷存在 ${mediumRiskCount} 个中风险信号，建议尽快收束推进缺口。`,
    }
  }

  return {
    overallLevel: 'low',
    summary: '当前卷未发现明显高风险结构断点。',
  }
}

function resolveMissionChapterIndex(chapterId: string, chapterIds: string[], minChapterIndex?: number): number | undefined {
  const offset = chapterIds.indexOf(chapterId)

  if (offset < 0 || minChapterIndex === undefined) {
    return undefined
  }

  return minChapterIndex + offset
}
