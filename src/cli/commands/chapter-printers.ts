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

export function printChapterCreated(chapter: {
  index: number
  title: string
  id: string
}): void {
  console.log(`Chapter created: #${chapter.index} ${chapter.title} (${chapter.id})`)
}

export function printChapterShowSummary(input: {
  chapter: {
    id: string
    index: number
    title: string
    status: string
    objective: string
    plannedBeats: string[]
    currentPlanVersionId?: string
    currentVersionId?: string
    approvedAt?: string
  }
  latestPlan: { versionId: string } | null
  latestDraft: { id: string; actualWordCount: number } | null
  latestReview: {
    id: string
    decision: string
    approvalRisk: string
    closureSuggestions: {
      characters: unknown[]
      items: unknown[]
      hooks: unknown[]
      memory: unknown[]
    }
    revisionAdvice: string[]
  } | null
  latestRewrite: { id: string; actualWordCount: number } | null
  latestOutput: { finalPath: string } | null
  latestOutcome: { id: string; decision: string; resolvedFacts: unknown[] } | null
  chapterDebts: unknown[]
  chapterContradictions: unknown[]
  latestStateUpdates: Array<{ summary: string }>
  latestMemoryUpdates: Array<{ summary: string }>
  latestHookUpdates: Array<{ summary: string }>
}): void {
  const {
    chapter,
    latestPlan,
    latestDraft,
    latestReview,
    latestRewrite,
    latestOutput,
    latestOutcome,
    chapterDebts,
    chapterContradictions,
    latestStateUpdates,
    latestMemoryUpdates,
    latestHookUpdates,
  } = input

  console.log(`Chapter: #${chapter.index} ${chapter.title}`)
  console.log(`ID: ${chapter.id}`)
  console.log(`Status: ${chapter.status}`)
  console.log(`Objective: ${chapter.objective}`)
  console.log(`Planned beats: ${chapter.plannedBeats.length}`)
  console.log(`Current plan version: ${chapter.currentPlanVersionId ?? '(none)'}`)
  console.log(`Current version: ${chapter.currentVersionId ?? '(none)'}`)
  console.log(`Approved at: ${chapter.approvedAt ?? '(not approved)'}`)

  if (latestPlan) {
    console.log(`Latest plan: ${latestPlan.versionId}`)
  }

  if (latestDraft) {
    console.log(`Latest draft: ${latestDraft.id} (${latestDraft.actualWordCount} chars)`)
  }

  if (latestReview) {
    console.log(`Latest review: ${latestReview.id} [${latestReview.decision}]`)
    console.log(`Latest review risk: ${latestReview.approvalRisk}`)
    console.log(
      `Latest review closures: ${latestReview.closureSuggestions.characters.length + latestReview.closureSuggestions.items.length + latestReview.closureSuggestions.hooks.length + latestReview.closureSuggestions.memory.length}`,
    )
    console.log(`Latest review advice: ${latestReview.revisionAdvice.slice(0, 2).join('；') || '(none)'}`)
  }

  if (latestRewrite) {
    console.log(`Latest rewrite: ${latestRewrite.id} (${latestRewrite.actualWordCount} chars)`)
  }

  if (latestOutput) {
    console.log(`Final output: ${latestOutput.finalPath}`)
  }

  if (latestOutcome) {
    console.log(`Latest outcome: ${latestOutcome.id} [${latestOutcome.decision}]`)
    console.log(`Outcome facts: ${latestOutcome.resolvedFacts.length}`)
    console.log(`Outcome debts: ${chapterDebts.length}`)
    console.log(`Outcome contradictions: ${chapterContradictions.length}`)
  }

  console.log(`Trace summary: state=${latestStateUpdates.length}; memory=${latestMemoryUpdates.length}; hook=${latestHookUpdates.length}`)

  if (latestStateUpdates[0]) {
    console.log(`Latest state trace: ${latestStateUpdates[0].summary}`)
  }

  if (latestMemoryUpdates[0]) {
    console.log(`Latest memory trace: ${latestMemoryUpdates[0].summary}`)
  }

  if (latestHookUpdates[0]) {
    console.log(`Latest hook trace: ${latestHookUpdates[0].summary}`)
  }
}

export function printChapterRewriteCreated(rewrite: {
  id: string
  versionId: string
  actualWordCount: number
  goals: string[]
  llmMetadata?: LlmMetadataView
}): void {
  console.log(`Chapter rewrite created: ${rewrite.id}`)
  console.log(`Version: ${rewrite.versionId}`)
  console.log(`Word count: ${rewrite.actualWordCount}`)
  console.log(`Goals: ${rewrite.goals.join('；')}`)
  printLlmMetadata(rewrite.llmMetadata)
}

export function printChapterApproved(result: {
  chapterId: string
  chapterStatus: string
  forcedApproval: boolean
  threadProgressUpdated: boolean
  endingReadinessUpdated: boolean
  finalPath: string
  approvedAt: string
}): void {
  console.log(`Chapter approved: ${result.chapterId}`)
  console.log(`Status: ${result.chapterStatus}`)
  console.log(`Forced approval: ${result.forcedApproval}`)
  console.log(`Thread progress updated: ${result.threadProgressUpdated}`)
  console.log(`Ending readiness updated: ${result.endingReadinessUpdated}`)
  console.log(`Final path: ${result.finalPath}`)
  console.log(`Approved at: ${result.approvedAt}`)
}

export function printChapterDropApplied(result: {
  chapterId: string
  dropMode: string
  previousChapterStatus: string
  nextChapterStatus: string
  droppedPlanVersionId?: string
  droppedDraftVersionId?: string
  droppedReviewId?: string
  droppedRewriteId?: string
}): void {
  console.log(`Chapter drop applied: ${result.chapterId}`)
  console.log(`Mode: ${result.dropMode}`)
  console.log(`Status: ${result.previousChapterStatus} -> ${result.nextChapterStatus}`)
  console.log(`Dropped plan: ${result.droppedPlanVersionId ?? '(none)'}`)
  console.log(`Dropped draft chain: ${result.droppedDraftVersionId ?? '(none)'}`)
  console.log(`Dropped review: ${result.droppedReviewId ?? '(none)'}`)
  console.log(`Dropped rewrite: ${result.droppedRewriteId ?? '(none)'}`)
}

export function printChapterReviewPreview(review: {
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

function printLlmMetadata(metadata?: LlmMetadataView): void {
  if (!metadata) {
    return
  }

  console.log(formatSection('LLM metadata:', formatJson(metadata)))
}
