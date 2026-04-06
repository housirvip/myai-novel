import { formatJson, formatSection } from '../../shared/utils/format.js'

type LlmMetadataView = {
  stage?: string
  selectedProvider: string
  selectedModel: string
  requestedProvider?: string
  requestedModel?: string
  providerSource: string
  modelSource: string
  fallbackUsed: boolean
  fallbackFromProvider?: string
  latencyMs?: number
  retryCount?: number
  responseId?: string
  requestId?: string
}

// workflow 命令更偏“过程细节”，因此这里会把计划、审阅、改写的结构化结果完整展开。
export function printWorkflowPlanCreated(plan: {
  versionId: string
  objective: string
  sceneCards: unknown[]
  eventOutline: unknown[]
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Chapter plan created: ${plan.versionId}`)
  console.log(`Objective: ${plan.objective}`)
  console.log(`Scenes: ${plan.sceneCards.length}`)
  console.log(`Events: ${plan.eventOutline.length}`)
  printLlmMetadata(plan.llmMetadata)
}

export function printWorkflowMissionDetail(input: {
  chapter: {
    id: string
    title: string
    volumeId: string
    index: number
  }
  volumePlan: unknown | null
  mission: unknown | null
}): void {
  console.log(`Chapter: #${input.chapter.index} ${input.chapter.title}`)
  console.log(`Chapter ID: ${input.chapter.id}`)
  console.log(`Volume ID: ${input.chapter.volumeId}`)
  console.log(formatSection('Volume plan:', formatJson(input.volumePlan)))
  console.log(formatSection('Current mission:', formatJson(input.mission)))
}

export function printWorkflowVolumePlanCreated(plan: {
  id: string
  title: string
  volumeId: string
  threadIds: string[]
  chapterMissions: unknown[]
}): void {
  console.log(`Volume window plan created: ${plan.id}`)
  console.log(`Volume: ${plan.volumeId}`)
  console.log(`Title: ${plan.title}`)
  console.log(`Thread count: ${plan.threadIds.length}`)
  console.log(`Mission count: ${plan.chapterMissions.length}`)
}

export function printWorkflowVolumePlanDetail(plan: {
  id: string
  title: string
  focusSummary: string
  rollingWindow: unknown
  threadIds: unknown
  chapterMissions: unknown
  endingSetupRequirements: unknown
}): void {
  console.log(`Volume plan id: ${plan.id}`)
  console.log(`Title: ${plan.title}`)
  console.log(`Focus summary: ${plan.focusSummary}`)
  console.log(formatSection('Rolling window:', formatJson(plan.rollingWindow)))
  console.log(formatSection('Thread ids:', formatJson(plan.threadIds)))
  console.log(formatSection('Chapter missions:', formatJson(plan.chapterMissions)))
  console.log(formatSection('Ending setup requirements:', formatJson(plan.endingSetupRequirements)))
}

export function printWorkflowPlanDetail(plan: {
  versionId: string
  objective: string
  missionId?: string
  threadFocus: unknown
  windowRole?: string
  carryInTasks: unknown
  carryOutTasks: unknown
  sceneCards: unknown
  sceneGoals: unknown
  sceneConstraints: unknown
  sceneEmotionalTargets: unknown
  sceneOutcomeChecklist: unknown
  eventOutline: unknown
  statePredictions: unknown
  highPressureHookIds: unknown
  characterArcTargets: unknown
  debtCarryTargets: unknown
  endingDrive: string
  mustResolveDebts: unknown
  mustAdvanceHooks: unknown
  mustPreserveFacts: unknown
  memoryCandidates: unknown
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Plan version: ${plan.versionId}`)
  console.log(`Objective: ${plan.objective}`)
  // mission/window role 单独输出，帮助确认这一版计划是承接卷窗口还是普通章节推进。
  console.log(formatSection('Mission id:', plan.missionId ?? '(none)'))
  console.log(formatSection('Thread focus:', formatJson(plan.threadFocus)))
  console.log(formatSection('Window role:', plan.windowRole ?? '(none)'))
  console.log(formatSection('Carry-in tasks:', formatJson(plan.carryInTasks)))
  console.log(formatSection('Carry-out tasks:', formatJson(plan.carryOutTasks)))
  console.log(formatSection('Scene cards:', formatJson(plan.sceneCards)))
  console.log(formatSection('Scene goals:', formatJson(plan.sceneGoals)))
  console.log(formatSection('Scene constraints:', formatJson(plan.sceneConstraints)))
  console.log(formatSection('Scene emotional targets:', formatJson(plan.sceneEmotionalTargets)))
  console.log(formatSection('Scene outcome checklist:', formatJson(plan.sceneOutcomeChecklist)))
  console.log(formatSection('Event outline:', formatJson(plan.eventOutline)))
  console.log(formatSection('State predictions:', formatJson(plan.statePredictions)))
  console.log(formatSection('High pressure hooks:', formatJson(plan.highPressureHookIds)))
  console.log(formatSection('Character arc targets:', formatJson(plan.characterArcTargets)))
  console.log(formatSection('Debt carry targets:', formatJson(plan.debtCarryTargets)))
  console.log(formatSection('Ending drive:', plan.endingDrive))
  console.log(formatSection('Must resolve debts:', formatJson(plan.mustResolveDebts)))
  console.log(formatSection('Must advance hooks:', formatJson(plan.mustAdvanceHooks)))
  console.log(formatSection('Must preserve facts:', formatJson(plan.mustPreserveFacts)))
  console.log(formatSection('Memory candidates:', formatJson(plan.memoryCandidates)))
  printLlmMetadata(plan.llmMetadata)
}

export function printWorkflowDraftCreated(result: {
  draftId: string
  chapterStatus: string
  actualWordCount: number
  nextAction: string
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Chapter draft created: ${result.draftId}`)
  console.log(`Status: ${result.chapterStatus}`)
  console.log(`Word count: ${result.actualWordCount}`)
  console.log(`Next action: ${result.nextAction}`)
  printLlmMetadata(result.llmMetadata)
}

export function printWorkflowReviewCreated(review: {
  id: string
  decision: string
  approvalRisk: string
  missionProgress: { status: string }
  threadIssues: unknown[]
  wordCountCheck: { passed: boolean }
  closureSuggestions: {
    characters: unknown[]
    items: unknown[]
    hooks: unknown[]
    memory: unknown[]
  }
  revisionAdvice: string[]
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Chapter review created: ${review.id}`)
  console.log(`Decision: ${review.decision}`)
  console.log(`Approval risk: ${review.approvalRisk}`)
  console.log(`Mission progress: ${review.missionProgress.status}`)
  console.log(`Thread issues: ${review.threadIssues.length}`)
  console.log(`Word count passed: ${review.wordCountCheck.passed}`)
  console.log(
    `Closure suggestions: ${review.closureSuggestions.characters.length + review.closureSuggestions.items.length + review.closureSuggestions.hooks.length + review.closureSuggestions.memory.length}`,
  )
  console.log(`Revision advice: ${review.revisionAdvice.join('；')}`)
  printLlmMetadata(review.llmMetadata)
}

export function printWorkflowVolumeReviewDetail(input: {
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
  chapterReviews: Array<{
    chapter: {
      id: string
      index: number
      title: string
      status: string
    }
    latestReview: unknown | null
  }>
}): void {
  console.log(`Volume review: ${input.volume.title} (${input.volume.id})`)
  console.log(`Goal: ${input.volume.goal}`)
  console.log(`Summary: ${input.volume.summary}`)
  console.log(`Chapter count: ${input.chapterReviews.length}`)
  // 卷级审阅的重点是跨章汇总，所以直接并排打印 volume plan、threads、ending readiness 与 chapter reviews。
  console.log(formatSection('Latest volume plan:', formatJson(input.latestVolumePlan)))
  console.log(formatSection('Story threads:', formatJson(input.storyThreads)))
  console.log(formatSection('Ending readiness current:', formatJson(input.endingReadiness)))
  console.log(formatSection('Chapter reviews:', formatJson(input.chapterReviews)))
}

export function printWorkflowReviewDetail(review: {
  id: string
  decision: string
  approvalRisk: string
  missionProgress: unknown
  threadIssues: unknown
  consistencyIssues: unknown
  characterIssues: unknown
  itemIssues: unknown
  memoryIssues: unknown
  pacingIssues: unknown
  hookIssues: unknown
  reviewLayers: {
    mustFix: unknown
    narrativeQuality: unknown
    languageQuality: unknown
    rewriteStrategySuggestion: unknown
  }
  newFactCandidates: unknown
  outcomeCandidate: unknown
  closureSuggestions: unknown
  wordCountCheck: unknown
  revisionAdvice: unknown
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Review id: ${review.id}`)
  console.log(`Decision: ${review.decision}`)
  console.log(`Approval risk: ${review.approvalRisk}`)
  console.log(formatSection('Mission progress:', formatJson(review.missionProgress)))
  console.log(formatSection('Thread issues:', formatJson(review.threadIssues)))
  console.log(formatSection('Consistency issues:', formatJson(review.consistencyIssues)))
  console.log(formatSection('Character issues:', formatJson(review.characterIssues)))
  console.log(formatSection('Item issues:', formatJson(review.itemIssues)))
  console.log(formatSection('Memory issues:', formatJson(review.memoryIssues)))
  console.log(formatSection('Pacing issues:', formatJson(review.pacingIssues)))
  console.log(formatSection('Hook issues:', formatJson(review.hookIssues)))
  console.log(formatSection('Must-fix issues:', formatJson(review.reviewLayers.mustFix)))
  console.log(formatSection('Narrative quality issues:', formatJson(review.reviewLayers.narrativeQuality)))
  console.log(formatSection('Language quality issues:', formatJson(review.reviewLayers.languageQuality)))
  console.log(formatSection('Rewrite strategy suggestion:', formatJson(review.reviewLayers.rewriteStrategySuggestion)))
  console.log(formatSection('New fact candidates:', formatJson(review.newFactCandidates)))
  console.log(formatSection('Outcome candidate:', formatJson(review.outcomeCandidate)))
  console.log(formatSection('Closure suggestions:', formatJson(review.closureSuggestions)))
  console.log(formatSection('Word count check:', formatJson(review.wordCountCheck)))
  console.log(formatSection('Revision advice:', formatJson(review.revisionAdvice)))
  printLlmMetadata(review.llmMetadata)
}

export function printWorkflowRewriteDetail(rewrite: {
  id: string
  versionId: string
  strategy: string
  strategyProfile: unknown
  qualityTarget: unknown
  actualWordCount: number
  validation: unknown
  goals: unknown
  content: string
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Rewrite id: ${rewrite.id}`)
  console.log(`Version: ${rewrite.versionId}`)
  console.log(`Strategy: ${rewrite.strategy}`)
  console.log(`Primary rewrite strategy: ${(rewrite.strategyProfile as { primary: string }).primary}`)
  console.log(`Word count: ${rewrite.actualWordCount}`)
  // 这里既保留结构化策略，也保留内容预览，方便确认“为什么改”与“改成了什么”。
  console.log(formatSection('Rewrite strategy profile:', formatJson(rewrite.strategyProfile)))
  console.log(formatSection('Rewrite quality target:', formatJson(rewrite.qualityTarget)))
  console.log(formatSection('Validation:', formatJson(rewrite.validation)))
  console.log(formatSection('Goals:', formatJson(rewrite.goals)))
  console.log(formatSection('Content preview:', rewrite.content))
  printLlmMetadata(rewrite.llmMetadata)
}

function printLlmMetadata(metadata?: LlmMetadataView): void {
  if (!metadata) {
    return
  }

  // 单独收口成 section，避免每个 workflow 子命令都重复挑字段打印。
  console.log(formatSection('LLM metadata:', formatJson(metadata)))
}
