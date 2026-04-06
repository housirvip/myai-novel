import { formatJson, formatSection } from '../../../shared/utils/format.js'

import { formatTrace, summarizeClosureSuggestions } from './shared.js'

type TraceDetail = {
  source: string
  reason: string
  evidence: string[]
  evidenceSummary?: string
  before?: string
  after?: string
  previousValueSummary?: string
  nextValueSummary?: string
}

// state 命令负责把“当前投影”和“最近变更痕迹”并排展示，便于核对状态是否真的落库。
export function printStoryState(state: unknown | null): void {
  if (!state) {
    console.log('Story state: (empty)')
    return
  }

  console.log(formatJson(state))
}

export function printStateShowSummary(input: {
  book: { title: string; id: string }
  currentChapterTitle: string | null
  storyState: {
    currentChapterId?: string | null
    recentEvents: unknown[]
    updatedAt?: string | null
  } | null
  characterStates: Array<{
    characterId: string
    currentLocationId?: string | null
    statusNotes: string[]
    updatedAt: string
  }>
  characterNameById: Map<string, string>
  locationNameById: Map<string, string>
  importantItems: Array<{
    id: string
    name: string
    ownerCharacterId?: string | null
    locationId?: string | null
    quantity: number
    status: string
    updatedAt?: string | null
  }>
  hookStates: Array<{
    hookId: string
    status: string
    updatedByChapterId?: string | null
    updatedAt: string
  }>
  hookTitleById: Map<string, string>
  characterArcs: unknown
  hookPressures: unknown
  activeStoryThreads: unknown
  recentThreadProgress: unknown
  latestVolumePlans: unknown
  endingReadiness: unknown
  openNarrativeDebts: unknown
  shortTermMemory: unknown
  observationMemory: unknown
  longTermMemory: unknown
  recentStateUpdates: Array<{
    entityType: string
    entityId: string
    detail: TraceDetail
    [key: string]: unknown
  }>
  itemNameById: Map<string, string>
  recentMemoryUpdates: Array<{
    detail: TraceDetail
    [key: string]: unknown
  }>
  recentHookUpdates: Array<{
    hookId: string
    detail: TraceDetail
    [key: string]: unknown
  }>
}): void {
  const {
    book,
    currentChapterTitle,
    storyState,
    characterStates,
    characterNameById,
    locationNameById,
    importantItems,
    hookStates,
    hookTitleById,
    characterArcs,
    hookPressures,
    activeStoryThreads,
    recentThreadProgress,
    latestVolumePlans,
    endingReadiness,
    openNarrativeDebts,
    shortTermMemory,
    observationMemory,
    longTermMemory,
    recentStateUpdates,
    itemNameById,
    recentMemoryUpdates,
    recentHookUpdates,
  } = input

  console.log(`Book: ${book.title}`)
  console.log(`Book ID: ${book.id}`)
  console.log(formatSection('Story current state:', formatJson({
    currentChapterId: storyState?.currentChapterId ?? null,
    currentChapterTitle,
    recentEvents: storyState?.recentEvents ?? [],
    updatedAt: storyState?.updatedAt ?? null,
  })))
  console.log(formatSection(
    'Character current state:',
    // 打印时补齐角色名/地点名，避免用户还要拿 id 再去查一次。
    formatJson(characterStates.map((state) => ({
      characterId: state.characterId,
      characterName: characterNameById.get(state.characterId) ?? state.characterId,
      currentLocationId: state.currentLocationId ?? null,
      currentLocationName: state.currentLocationId ? (locationNameById.get(state.currentLocationId) ?? null) : null,
      statusNotes: state.statusNotes,
      updatedAt: state.updatedAt,
    }))),
  ))
  console.log(formatSection(
    'Important item current state:',
    // 重要物品既显示 owner 也显示 location，兼容“被谁持有”和“落在某处无人持有”两种情况。
    formatJson(importantItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      ownerCharacterId: item.ownerCharacterId ?? null,
      ownerCharacterName: item.ownerCharacterId ? (characterNameById.get(item.ownerCharacterId) ?? null) : null,
      locationId: item.locationId ?? null,
      locationName: item.locationId ? (locationNameById.get(item.locationId) ?? null) : null,
      quantity: item.quantity,
      status: item.status,
      updatedAt: item.updatedAt || null,
    }))),
  ))
  console.log(formatSection(
    'Hook current state:',
    formatJson(hookStates.map((state) => ({
      hookId: state.hookId,
      hookTitle: hookTitleById.get(state.hookId) ?? state.hookId,
      status: state.status,
      updatedByChapterId: state.updatedByChapterId ?? null,
      updatedAt: state.updatedAt,
    }))),
  ))
  console.log(formatSection('Character arc current state:', formatJson(characterArcs)))
  console.log(formatSection('Hook pressure current:', formatJson(hookPressures)))
  console.log(formatSection('Active story threads:', formatJson(activeStoryThreads)))
  console.log(formatSection('Recent thread progress:', formatJson(recentThreadProgress)))
  console.log(formatSection('Latest volume plans:', formatJson(latestVolumePlans)))
  console.log(formatSection('Ending readiness current:', formatJson(endingReadiness)))
  console.log(formatSection('Open narrative debts:', formatJson(openNarrativeDebts)))
  console.log(formatSection('Short-term memory current:', formatJson(shortTermMemory)))
  console.log(formatSection('Observation memory current:', formatJson(observationMemory)))
  console.log(formatSection('Long-term memory current:', formatJson(longTermMemory)))
  console.log(formatSection(
    'Recent state updates:',
    // recent updates 额外输出格式化 trace，让 before/after 与证据摘要更易读。
    formatJson(recentStateUpdates.map((update) => ({
      ...update,
      entityName:
        update.entityType === 'character'
          ? (characterNameById.get(update.entityId) ?? update.entityId)
          : (itemNameById.get(update.entityId) ?? update.entityId),
      trace: formatTrace(update.detail),
    }))),
  ))
  console.log(formatSection(
    'Recent memory updates:',
    formatJson(recentMemoryUpdates.map((update) => ({
      ...update,
      trace: formatTrace(update.detail),
    }))),
  ))
  console.log(formatSection(
    'Recent hook updates:',
    formatJson(recentHookUpdates.map((update) => ({
      ...update,
      hookTitle: hookTitleById.get(update.hookId) ?? update.hookId,
      trace: formatTrace(update.detail),
    }))),
  ))
}

export function printStateUpdatesSummary(input: {
  chapter: { index: number; title: string; id: string; status: string; bookId?: string } | null
  review: {
    id: string
    decision: string
    approvalRisk: string
    closureSuggestions: {
      characters: unknown[]
      items: unknown[]
      hooks: unknown[]
      memory: unknown[]
    }
    consistencyIssues: string[]
    characterIssues: string[]
    itemIssues: string[]
    memoryIssues: string[]
    hookIssues: string[]
    revisionAdvice: string[]
  } | null
  stateUpdates: Array<{
    entityType: string
    entityId: string
    detail: TraceDetail
    [key: string]: unknown
  }>
  memoryUpdates: Array<{
    detail: TraceDetail
    [key: string]: unknown
  }>
  hookUpdates: Array<{
    hookId: string
    detail: TraceDetail
    [key: string]: unknown
  }>
  characterNameById: Map<string, string>
  itemNameById: Map<string, string>
  hookTitleById: Map<string, string>
}): void {
  if (input.chapter) {
    console.log(`Chapter: #${input.chapter.index} ${input.chapter.title}`)
    console.log(`Chapter ID: ${input.chapter.id}`)
    console.log(`Status: ${input.chapter.status}`)
  }

  if (input.review) {
    console.log(formatSection(
      'Latest review:',
      formatJson({
        reviewId: input.review.id,
        decision: input.review.decision,
        approvalRisk: input.review.approvalRisk,
        // 这里只取前几条问题和建议，作为“为什么产生这些更新”的简短背景。
        closureSummary: summarizeClosureSuggestions(input.review.closureSuggestions),
        topIssues: [
          ...input.review.consistencyIssues,
          ...input.review.characterIssues,
          ...input.review.itemIssues,
          ...input.review.memoryIssues,
          ...input.review.hookIssues,
        ].slice(0, 5),
        revisionAdvice: input.review.revisionAdvice.slice(0, 5),
      }),
    ))
    console.log(formatSection('Review closure suggestions:', formatJson(input.review.closureSuggestions)))
  }

  console.log(formatSection(
    'State updates:',
    formatJson(input.stateUpdates.map((update) => ({
      ...update,
      entityName:
        update.entityType === 'character'
          ? (input.characterNameById.get(update.entityId) ?? update.entityId)
          : (input.itemNameById.get(update.entityId) ?? update.entityId),
      trace: formatTrace(update.detail),
    }))),
  ))
  console.log(formatSection(
    'Memory updates:',
    formatJson(input.memoryUpdates.map((update) => ({
      ...update,
      trace: formatTrace(update.detail),
    }))),
  ))
  console.log(formatSection(
    'Hook updates:',
    formatJson(input.hookUpdates.map((update) => ({
      ...update,
      hookTitle: input.hookTitleById.get(update.hookId) ?? update.hookId,
      trace: formatTrace(update.detail),
    }))),
  ))
}

export function printStateThreadsSummary(input: {
  book: { id: string; title: string }
  volume: { id: string; title: string } | null
  activeThreads: unknown[]
  recentProgress: unknown[]
}): void {
  console.log(`Book: ${input.book.title}`)

  if (input.volume) {
    // volume 可选，是因为线程既可以按整书看，也可以按当前卷窗口聚焦。
    console.log(`Volume: ${input.volume.title} (${input.volume.id})`)
  }

  console.log(formatSection('Active story threads:', formatJson(input.activeThreads)))
  console.log(formatSection('Recent thread progress:', formatJson(input.recentProgress)))
}

export function printStateEndingSummary(input: {
  book: { id: string; title: string }
  endingReadiness: unknown | null
}): void {
  console.log(`Book: ${input.book.title}`)
  console.log(formatSection('Ending readiness current:', formatJson(input.endingReadiness)))
}

export function printStateVolumePlanSummary(input: {
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
  }
  latestVolumePlan: unknown | null
}): void {
  console.log(`Book: ${input.book.title}`)
  console.log(`Volume: ${input.volume.title} (${input.volume.id})`)
  console.log(`Goal: ${input.volume.goal}`)
  console.log(`Summary: ${input.volume.summary}`)
  console.log(formatSection('Latest volume plan:', formatJson(input.latestVolumePlan)))
}
