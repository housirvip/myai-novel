import path from 'node:path'
import { writeFile } from 'node:fs/promises'

import type {
  ApproveResult,
  ChapterHookUpdate,
  ChapterOutcome,
  ChapterPlan,
  ChapterMemoryUpdate,
  ChapterOutput,
  ChapterRewrite,
  ChapterStateUpdate,
  CharacterCurrentState,
  ClosureSuggestions,
  Hook,
  HookPlan,
  ItemCurrentState,
  LongTermMemoryEntry,
  NarrativeContradiction,
  NarrativeDebt,
  ReviewReport,
  StoryState,
  StoryThreadProgress,
  UpdateTraceDetail,
} from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import {
  buildCompletedChapterFilename,
  resolveProjectPaths,
} from '../../shared/utils/project-paths.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import type { CharacterRepository } from '../../infra/repository/character-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterContradictionRepository } from '../../infra/repository/chapter-contradiction-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import type { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import type { ChapterOutcomeRepository } from '../../infra/repository/chapter-outcome-repository.js'
import type { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import type { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import type { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { ItemRepository } from '../../infra/repository/item-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import type { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import type { StoryThreadProgressRepository } from '../../infra/repository/story-thread-progress-repository.js'

type DraftSource =
  | { sourceType: 'rewrite'; sourceId: string; versionId: string; content: string }
  | { sourceType: 'draft'; sourceId: string; versionId: string; content: string }

export class ApproveService {
  constructor(
    private readonly rootDir: string,
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterRewriteRepository: ChapterRewriteRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly chapterOutcomeRepository: ChapterOutcomeRepository,
    private readonly narrativeDebtRepository: NarrativeDebtRepository,
    private readonly chapterContradictionRepository: ChapterContradictionRepository,
    private readonly chapterOutputRepository: ChapterOutputRepository,
    private readonly chapterStateUpdateRepository: ChapterStateUpdateRepository,
    private readonly chapterMemoryUpdateRepository: ChapterMemoryUpdateRepository,
    private readonly chapterHookUpdateRepository: ChapterHookUpdateRepository,
    private readonly storyStateRepository: StoryStateRepository,
    private readonly storyThreadProgressRepository: StoryThreadProgressRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly characterArcRepository: CharacterArcRepository,
    private readonly hookRepository: HookRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly hookPressureRepository: HookPressureRepository,
    private readonly itemRepository: ItemRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
  ) {}

  async approveChapter(chapterId: string, options?: { force?: boolean }): Promise<ApproveResult> {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    if (chapter.status !== 'reviewed') {
      throw new NovelError('Only reviewed chapters can be approved.')
    }

    if (!chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing for approval.')
    }

    if (!chapter.currentVersionId) {
      throw new NovelError('Current chapter source is missing for approval.')
    }

    const plan = this.resolvePlan(chapterId, chapter.currentPlanVersionId)
    const review = this.chapterReviewRepository.getLatestByChapterId(chapterId)

    if (review?.approvalRisk === 'high' && !options?.force) {
      throw new NovelError(`Chapter review risk is high for ${chapterId}. Re-run after rewrite or use --force to approve anyway.`)
    }

    const closureSuggestions = review?.closureSuggestions ?? emptyClosureSuggestions()
    const source = this.resolveSource(chapterId, chapter.currentVersionId)
    const approvedAt = nowIso()
    const chapterSummary = buildChapterSummary(chapter, review)
    const projectPaths = resolveProjectPaths(this.rootDir)
    const finalFilename = buildCompletedChapterFilename(chapter.index, chapter.title)
    const finalPath = path.join(projectPaths.completedChaptersDir, finalFilename)

    await writeFile(finalPath, `${source.content}\n`, 'utf8')

    const output: ChapterOutput = {
      id: createId('output'),
      bookId: book.id,
      chapterId,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      finalPath,
      content: source.content,
      createdAt: approvedAt,
    }

    const state: StoryState = {
      bookId: book.id,
      currentChapterId: chapterId,
      recentEvents: [`第 ${chapter.index} 章《${chapter.title}》已确认终稿`],
      updatedAt: approvedAt,
    }

    const hookUpdates = this.updateHookStates(
      book.id,
      chapterId,
      source.content,
      approvedAt,
      closureSuggestions,
      plan?.hookPlan ?? [],
    )
    const stateUpdates = [
      ...this.updateCharacterState(
        book.id,
        chapterId,
        source.content,
        approvedAt,
        closureSuggestions,
        plan?.requiredCharacterIds ?? [],
      ),
      ...this.updateItemStates(
        book.id,
        chapterId,
        source.content,
        approvedAt,
        closureSuggestions,
        plan?.requiredItemIds ?? [],
      ),
    ]

    const previousShortTerm = this.memoryRepository.getShortTermByBookId(book.id)
    const previousObservation = this.memoryRepository.getObservationByBookId(book.id)
    const previousLongTerm = this.memoryRepository.getLongTermByBookId(book.id)
    const nextShortTermSummaries = mergeRecentStrings(
      previousShortTerm?.summaries ?? [],
      buildShortTermSummaries(chapter.index, chapter.title, closureSuggestions),
      3,
    )
    const nextShortTermEvents = mergeRecentStrings(
      previousShortTerm?.recentEvents ?? [],
      [...state.recentEvents, ...buildShortTermEvents(chapter.index, chapter.title, closureSuggestions)],
      5,
    )
    const nextLongTermEntries = mergeLongTermEntries(
      previousLongTerm?.entries ?? [],
      buildLongTermCandidates(review, chapter.index, chapter.title, chapterId),
    )

    this.memoryRepository.upsertShortTerm({
      bookId: book.id,
      chapterId,
      summaries: nextShortTermSummaries,
      recentEvents: nextShortTermEvents,
      updatedAt: approvedAt,
    })
    this.memoryRepository.upsertObservation({
      bookId: book.id,
      chapterId,
      entries: buildObservationEntries(closureSuggestions, previousObservation?.entries ?? [], chapterId),
      updatedAt: approvedAt,
    })
    this.memoryRepository.upsertLongTerm({
      bookId: book.id,
      chapterId,
      entries: nextLongTermEntries,
      updatedAt: approvedAt,
    })

    const memoryUpdates = this.buildMemoryUpdates(
      book.id,
      chapterId,
      approvedAt,
      previousShortTerm?.summaries ?? [],
      previousShortTerm?.recentEvents ?? [],
      previousObservation?.entries ?? [],
      previousLongTerm?.entries ?? [],
      nextShortTermSummaries,
      nextShortTermEvents,
      buildObservationEntries(closureSuggestions, previousObservation?.entries ?? [], chapterId),
      nextLongTermEntries,
      closureSuggestions,
    )

    const outcome = this.buildChapterOutcome(book.id, chapterId, review, source.sourceType === 'rewrite' ? source.sourceId : undefined, approvedAt)

    this.chapterOutputRepository.create(output)
    this.storyStateRepository.upsert(state)
    this.chapterOutcomeRepository.create(outcome)
    this.narrativeDebtRepository.createBatch(outcome.narrativeDebts)
    this.chapterContradictionRepository.createBatch(outcome.contradictions)
    this.updateCharacterArcState(book.id, chapterId, approvedAt, outcome)
    this.updateHookPressureState(book.id, chapter.index, chapterId, approvedAt, outcome)
    this.persistStoryThreadProgress(book.id, chapterId, approvedAt, plan, review, outcome)

    this.persistUpdateLogs(stateUpdates, memoryUpdates, hookUpdates)
    this.chapterRepository.finalizeChapter(chapterId, source.versionId, finalPath, chapterSummary, approvedAt)

    return {
      chapterId,
      chapterStatus: 'finalized',
      versionId: source.versionId,
      finalPath,
      stateUpdated: true,
      memoryUpdated: true,
      hooksUpdated: true,
      threadProgressUpdated: true,
      approvedAt,
      forcedApproval: Boolean(options?.force && review?.approvalRisk === 'high'),
    }
  }

  private updateHookStates(
    bookId: string,
    chapterId: string,
    content: string,
    updatedAt: string,
    closureSuggestions: ClosureSuggestions,
    hookPlan: HookPlan[],
  ): ChapterHookUpdate[] {
    const hooks = this.hookRepository.listByBookId(bookId)
    const hookById = new Map(hooks.map((hook) => [hook.id, hook]))
    const currentStates = this.hookStateRepository.listByBookId(bookId)
    const currentStateByHookId = new Map(currentStates.map((state) => [state.hookId, state]))
    const hookPlanById = new Map(hookPlan.map((item) => [item.hookId, item]))
    const hookSuggestionById = new Map(closureSuggestions.hooks.map((item) => [item.hookId, item]))
    const targetHookIds = [...new Set([
      ...currentStates.filter((state) => state.status !== 'resolved').map((state) => state.hookId),
      ...hookPlan.map((item) => item.hookId),
      ...closureSuggestions.hooks.map((item) => item.hookId),
    ])]
    const updates: ChapterHookUpdate[] = []

    for (const hookId of targetHookIds) {
      const hook = hookById.get(hookId)
      const currentStatus = currentStateByHookId.get(hookId)?.status ?? hook?.status ?? 'open'
      const planItem = hookPlanById.get(hookId)
      const suggestion = hookSuggestionById.get(hookId)
      const line = findStructuredLine(content, `Hook（${hookId}）`)
      const explicitAction = line ? extractStructuredValue(line, '动作') : undefined
      const textEvidence = collectHookTextEvidence(
        content,
        hookId,
        hook?.title,
        planItem?.note,
        hook?.description,
        hook?.payoffExpectation,
      )
      const hasFactEvidence = Boolean(line) || textEvidence.length > 0
      const nextStatus = suggestion
        ? suggestion.nextStatus
        : explicitAction
          ? mapHookActionToStatus(explicitAction, currentStatus)
          : hasFactEvidence && planItem
            ? transitionHookStatus(currentStatus, planItem.action)
            : currentStatus

      this.hookStateRepository.upsert({
        bookId,
        hookId,
        status: nextStatus,
        updatedByChapterId: chapterId,
        updatedAt,
      })

      updates.push({
        id: createId('hook_update'),
        bookId,
        chapterId,
        hookId,
        status: nextStatus,
        summary: buildHookUpdateSummary(hook?.title ?? hookId, currentStatus, nextStatus, suggestion, explicitAction, planItem, hasFactEvidence),
        detail: buildHookTraceDetail(currentStatus, nextStatus, suggestion, explicitAction, planItem, line, textEvidence),
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private updateCharacterState(
    bookId: string,
    chapterId: string,
    content: string,
    updatedAt: string,
    closureSuggestions: ClosureSuggestions,
    requiredCharacterIds: string[],
  ): ChapterStateUpdate[] {
    const protagonist = this.characterRepository.getPrimaryByBookId(bookId)
    const currentStates = this.characterCurrentStateRepository.listByBookId(bookId)
    const stateByCharacterId = new Map(currentStates.map((state) => [state.characterId, state]))
    const characterSuggestionById = new Map(closureSuggestions.characters.map((item) => [item.characterId, item]))
    const targetCharacterIds = uniqueStrings([
      ...requiredCharacterIds,
      ...(protagonist ? [protagonist.id] : []),
      ...closureSuggestions.characters.map((item) => item.characterId),
    ])
    const updates: ChapterStateUpdate[] = []

    for (const characterId of targetCharacterIds) {
      const previousState = stateByCharacterId.get(characterId)
      const suggestion = characterSuggestionById.get(characterId)
      const line = findStructuredLine(content, `角色（${characterId}）`)
      const explicitLocation = line ? extractStructuredValue(line, '当前位置') : undefined
      const explicitStatus = line ? extractStructuredValue(line, '状态') : undefined

      if (!previousState && !line && !suggestion && characterId !== protagonist?.id) {
        continue
      }

      const currentLocationId = suggestion?.nextLocationId ??
        (explicitLocation?.startsWith('location_') ? explicitLocation : previousState?.currentLocationId)
      const statusNotes = suggestion && suggestion.nextStatusNotes.length > 0
        ? suggestion.nextStatusNotes
        : explicitStatus
          ? splitStructuredNotes(explicitStatus)
          : previousState?.statusNotes ??
            (characterId === protagonist?.id
              ? ['章节确认后沿用主角当前状态，等待后续章节继续细化']
              : ['章节确认后沿用既有角色状态'])

      const state: CharacterCurrentState = {
        bookId,
        characterId,
        currentLocationId,
        statusNotes,
        updatedAt,
      }

      this.characterCurrentStateRepository.upsert(state)

      updates.push({
        id: createId('state_update'),
        bookId,
        chapterId,
        entityType: 'character',
        entityId: characterId,
        summary: suggestion
          ? formatCharacterUpdateSummary(characterId, previousState, currentLocationId, statusNotes, suggestion)
          : `角色 ${characterId} 当前状态已确认：位置=${currentLocationId ?? '未知'}；状态=${statusNotes.join(' / ') || '无'}`,
        detail: buildCharacterTraceDetail(previousState, currentLocationId, statusNotes, suggestion, explicitLocation, explicitStatus),
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private updateItemStates(
    bookId: string,
    chapterId: string,
    content: string,
    updatedAt: string,
    closureSuggestions: ClosureSuggestions,
    requiredItemIds: string[],
  ): ChapterStateUpdate[] {
    const items = this.itemRepository.listByBookId(bookId)
    const updates: ChapterStateUpdate[] = []
    const targetItemIds = new Set([...requiredItemIds, ...closureSuggestions.items.map((item) => item.itemId)])
    const itemSuggestionById = new Map(closureSuggestions.items.map((item) => [item.itemId, item]))

    for (const item of items) {
      const line = findStructuredLine(content, `${item.name}（${item.id}）`)
      const isMentioned = Boolean(line) || content.includes(item.name) || content.includes(item.id)

      if (!item.isImportant && !targetItemIds.has(item.id) && !isMentioned) {
        continue
      }

      const previousState = this.itemCurrentStateRepository.getByItemId(bookId, item.id)
      const suggestion = itemSuggestionById.get(item.id)
      const explicitQuantity = line ? extractStructuredValue(line, '数量') : undefined
      const explicitStatus = line ? extractStructuredValue(line, '状态') : undefined
      const explicitOwner = line ? extractStructuredValue(line, '持有者') : undefined
      const explicitLocation = line ? extractStructuredValue(line, '地点') : undefined
      const nextOwnerCharacterId = suggestion?.nextOwnerCharacterId ??
        (explicitOwner?.startsWith('character_') ? explicitOwner : previousState?.ownerCharacterId)
      const nextLocationId = suggestion?.nextLocationId ??
        (explicitLocation?.startsWith('location_') ? explicitLocation : previousState?.locationId)
      const nextState: ItemCurrentState = {
        bookId,
        itemId: item.id,
        ownerCharacterId: nextOwnerCharacterId,
        locationId: nextLocationId,
        quantity: suggestion?.nextQuantity ?? (explicitQuantity ? Number.parseInt(explicitQuantity, 10) : (previousState?.quantity ?? 1)),
        status: suggestion?.nextStatus ?? explicitStatus ?? previousState?.status ?? '已在终稿中承接',
        updatedAt,
      }

      this.itemCurrentStateRepository.upsert(nextState)

      updates.push({
        id: createId('state_update'),
        bookId,
        chapterId,
        entityType: 'item',
        entityId: item.id,
        summary: suggestion
          ? formatItemUpdateSummary(item.name, previousState ?? undefined, nextState, suggestion)
          : `物品 ${item.name} 已确认：数量=${nextState.quantity}；状态=${nextState.status}；持有者=${nextState.ownerCharacterId ?? '未知'}；地点=${nextState.locationId ?? '未知'}`,
        detail: buildItemTraceDetail(previousState ?? undefined, nextState, suggestion, explicitQuantity, explicitStatus, explicitOwner, explicitLocation),
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private buildMemoryUpdates(
    bookId: string,
    chapterId: string,
    createdAt: string,
    previousShortTermSummaries: string[],
    previousShortTermEvents: string[],
    previousObservationEntries: Array<{ summary: string; sourceChapterId?: string }>,
    previousLongTermEntries: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
    shortTermSummaries: string[],
    shortTermEvents: string[],
    observationEntries: Array<{ summary: string; sourceChapterId?: string }>,
    longTermEntries: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
    closureSuggestions: ClosureSuggestions,
  ): ChapterMemoryUpdate[] {
    const shortTermSuggestions = closureSuggestions.memory.filter((item) => item.memoryScope === 'short-term')
    const observationSuggestions = closureSuggestions.memory.filter((item) => item.memoryScope === 'observation')
    const longTermSuggestions = closureSuggestions.memory.filter((item) => item.memoryScope === 'long-term')
    const shortTermSuggestionSummaries = [
      ...shortTermSuggestions.map((item) => item.summary),
      ...observationSuggestions.map((item) => `待观察：${item.summary}`),
    ]

    return [
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'short-term',
        summary: shortTermSuggestionSummaries.length > 0
          ? `短期记忆已更新：${shortTermSuggestionSummaries.slice(0, 2).join('；')}`
          : `短期记忆已更新：${shortTermSummaries.at(-1) ?? shortTermEvents.at(-1) ?? '最近事件窗口已刷新'}`,
        detail: shortTermSuggestionSummaries.length > 0
          ? {
              source: 'closure-suggestion',
              reason: buildShortTermMemoryReason(shortTermSuggestions, observationSuggestions),
              evidence: collectMemoryEvidence([...shortTermSuggestions, ...observationSuggestions]),
              before: previousShortTermSummaries.at(-1) ?? previousShortTermEvents.at(-1),
              after: shortTermSummaries.at(-1) ?? shortTermEvents.at(-1),
            }
          : {
              source: 'fallback',
              reason: '基于章节确认刷新短期记忆窗口',
              evidence: stateEvidence(shortTermSummaries, shortTermEvents),
              before: previousShortTermSummaries.at(-1) ?? previousShortTermEvents.at(-1),
              after: shortTermSummaries.at(-1) ?? shortTermEvents.at(-1),
            },
        createdAt,
      },
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'observation',
        summary: observationSuggestions.length > 0
          ? `待观察事实已更新：${observationSuggestions.slice(0, 2).map((item) => item.summary).join('；')}`
          : `待观察事实已更新：${observationEntries.at(-1)?.summary ?? '观察池已刷新'}`,
        detail: observationSuggestions.length > 0
          ? {
              source: 'closure-suggestion',
              reason: `review 建议保留 ${observationSuggestions.length} 条待观察事实，暂不进入长期记忆`,
              evidence: collectMemoryEvidence(observationSuggestions),
              before: previousObservationEntries.at(-1)?.summary,
              after: observationEntries.at(-1)?.summary,
            }
          : {
              source: 'fallback',
              reason: '沿用当前待观察事实池',
              evidence: observationEntries.slice(-3).map((item) => item.summary),
              before: previousObservationEntries.at(-1)?.summary,
              after: observationEntries.at(-1)?.summary,
            },
        createdAt,
      },
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'long-term',
        summary: longTermSuggestions.length > 0
          ? `长期记忆已更新：${longTermSuggestions.slice(0, 2).map((item) => item.summary).join('；')}`
          : `长期记忆已更新：${longTermEntries[0]?.summary ?? '高重要事实集合已刷新'}`,
        detail: longTermSuggestions.length > 0
          ? {
              source: 'closure-suggestion',
              reason: `review 建议确认 ${longTermSuggestions.length} 条长期稳定事实进入真源`,
              evidence: collectMemoryEvidence(longTermSuggestions),
              before: previousLongTermEntries[0]?.summary,
              after: longTermEntries[0]?.summary,
            }
          : {
              source: 'fallback',
              reason: '基于章节确认与候选事实刷新长期记忆',
              evidence: longTermEntries.slice(0, 3).map((item) => item.summary),
              before: previousLongTermEntries[0]?.summary,
              after: longTermEntries[0]?.summary,
            },
        createdAt,
      },
    ]
  }

  private buildChapterOutcome(
    bookId: string,
    chapterId: string,
    review: ReviewReport | null,
    sourceRewriteId: string | undefined,
    createdAt: string,
  ): ChapterOutcome {
    const outcomeId = createId('outcome')
    const candidate = review?.outcomeCandidate ?? emptyOutcomeCandidate(review?.decision ?? 'warning')
    const narrativeDebts: NarrativeDebt[] = candidate.narrativeDebts.map((item) => ({
      id: createId('debt'),
      bookId,
      chapterId,
      outcomeId,
      debtType: item.debtType,
      summary: item.summary,
      priority: item.priority,
      status: item.status,
      sourceReviewId: review?.id,
      sourceRewriteId,
      createdAt,
    }))
    const contradictions: NarrativeContradiction[] = candidate.contradictions.map((item) => ({
      id: createId('contradiction'),
      bookId,
      chapterId,
      outcomeId,
      contradictionType: item.contradictionType,
      summary: item.summary,
      severity: item.severity,
      status: item.status,
      sourceReviewId: review?.id,
      sourceRewriteId,
      createdAt,
    }))

    return {
      id: outcomeId,
      bookId,
      chapterId,
      sourceReviewId: review?.id,
      sourceRewriteId,
      decision: candidate.decision,
      resolvedFacts: candidate.resolvedFacts,
      observationFacts: candidate.observationFacts,
      contradictions,
      narrativeDebts,
      characterArcProgress: candidate.characterArcProgress,
      hookDebtUpdates: candidate.hookDebtUpdates,
      createdAt,
    }
  }

  private updateCharacterArcState(
    bookId: string,
    chapterId: string,
    updatedAt: string,
    outcome: ChapterOutcome,
  ): void {
    for (const progress of outcome.characterArcProgress) {
      this.characterArcRepository.upsert({
        bookId,
        characterId: progress.characterId,
        arc: progress.arc,
        currentStage: normalizeCharacterArcStage(progress.stage),
        updatedByChapterId: chapterId,
        summary: progress.summary,
        updatedAt,
      })
    }
  }

  private updateHookPressureState(
    bookId: string,
    chapterIndex: number,
    chapterId: string,
    updatedAt: string,
    outcome: ChapterOutcome,
  ): void {
    for (const update of outcome.hookDebtUpdates) {
      this.hookPressureRepository.upsert({
        bookId,
        hookId: update.hookId,
        pressureScore: mapPressureToScore(update.pressure),
        riskLevel: mapPressureToRiskLevel(update.pressure),
        lastAdvancedChapterId: chapterId,
        nextSuggestedChapterIndex: chapterIndex + mapPressureToWindow(update.pressure),
        updatedAt,
      })
    }
  }

  private persistUpdateLogs(
    stateUpdates: ChapterStateUpdate[],
    memoryUpdates: ChapterMemoryUpdate[],
    hookUpdates: ChapterHookUpdate[],
  ): void {
    for (const update of stateUpdates) {
      this.chapterStateUpdateRepository.create(update)
    }

    for (const update of memoryUpdates) {
      this.chapterMemoryUpdateRepository.create(update)
    }

    for (const update of hookUpdates) {
      this.chapterHookUpdateRepository.create(update)
    }
  }

  private persistStoryThreadProgress(
    bookId: string,
    chapterId: string,
    createdAt: string,
    plan: ChapterPlan | null,
    review: ReviewReport | null,
    outcome: ChapterOutcome,
  ): void {
    const missionMatchedThreadIds =
      plan?.missionId && review?.missionProgress.missionId === plan.missionId
        ? (plan.threadFocus ?? [])
        : []
    const threadIds = [...new Set([
      ...(plan?.threadFocus ?? []),
      ...missionMatchedThreadIds,
    ])]

    for (const threadId of threadIds) {
      const impacts: StoryThreadProgress['impacts'] = [
        {
          threadId,
          impactType: review?.missionProgress.status === 'completed' ? 'advance' : 'stall',
          summary: review?.missionProgress.missionSummary ?? `章节 ${chapterId} 对线程 ${threadId} 的推进记录。`,
        },
      ]

      this.storyThreadProgressRepository.create({
        id: createId('thread_progress'),
        bookId,
        threadId,
        chapterId,
        progressStatus: review?.missionProgress.status === 'completed' ? 'advanced' : 'stalled',
        summary:
          review?.missionProgress.status === 'completed'
            ? `本章已完成线程 ${threadId} 对应 mission 推进。`
            : `本章对线程 ${threadId} 的 mission 推进不足。`,
        impacts,
        createdAt,
      })
    }
  }

  private resolveSource(chapterId: string, currentVersionId: string): DraftSource {
    const rewrite = this.chapterRewriteRepository.getLatestByChapterId(chapterId)

    if (rewrite?.versionId === currentVersionId) {
      return mapRewriteSource(rewrite)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (draft?.versionId === currentVersionId) {
      return {
        sourceType: 'draft',
        sourceId: draft.id,
        versionId: draft.versionId,
        content: draft.content,
      }
    }

    throw new NovelError('Current draft or rewrite candidate is missing for approval.')
  }

  private resolvePlan(chapterId: string, currentPlanVersionId: string): ChapterPlan | null {
    return this.chapterPlanRepository.getByVersionId(chapterId, currentPlanVersionId)
  }
}

function mapRewriteSource(rewrite: ChapterRewrite): DraftSource {
  return {
    sourceType: 'rewrite',
    sourceId: rewrite.id,
    versionId: rewrite.versionId,
    content: rewrite.content,
  }
}

function buildChapterSummary(
  chapter: { title: string; objective: string },
  review: ReviewReport | null,
): string {
  const closureHighlights = review?.closureSuggestions.memory
    .map((item) => item.summary.trim())
    .filter((item) => item.length > 0)
    .slice(0, 2) ?? []
  const factHighlights = (review?.newFactCandidates ?? [])
    .map((item) => normalizeSummaryCandidate(item))
    .filter((item) => item.length > 0)
    .slice(0, 2)
  const highlights = closureHighlights.length > 0 ? closureHighlights : factHighlights

  const summaryParts = [chapter.objective, ...highlights]
  const deduped = [...new Set(summaryParts.map((item) => item.trim()).filter((item) => item.length > 0))]

  return deduped.length > 0
    ? deduped.join('；')
    : `本章《${chapter.title}》推进了既定目标并形成新的主线变化。`
}

function normalizeSummaryCandidate(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    if (typeof candidate.content === 'string') {
      return candidate.content.trim()
    }
  }

  return ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findStructuredLine(content: string, label: string): string | null {
  return content.match(new RegExp(`^.*${escapeRegExp(label)}.*$`, 'm'))?.[0] ?? null
}

function extractStructuredValue(line: string, key: string): string | undefined {
  return line.match(new RegExp(`${escapeRegExp(key)}=([^；\n]+)`))?.[1]?.trim()
}

function splitStructuredNotes(value: string): string[] {
  return value
    .split(/[\/｜|；;,，、]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function mergeRecentStrings(previous: string[], next: string[], limit: number): string[] {
  return [...new Set([...previous, ...next])].slice(-limit)
}

function mergeLongTermEntries(
  previous: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
  next: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
): Array<{ summary: string; importance: number; sourceChapterId?: string }> {
  const merged = new Map<string, { summary: string; importance: number; sourceChapterId?: string }>()

  for (const entry of [...previous, ...next]) {
    const existing = merged.get(entry.summary)

    if (!existing || existing.importance <= entry.importance) {
      merged.set(entry.summary, entry)
    }
  }

  return [...merged.values()].sort((left, right) => right.importance - left.importance).slice(0, 10)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function transitionHookStatus(currentStatus: Hook['status'], action: HookPlan['action']): Hook['status'] {
  if (action === 'foreshadow') {
    return 'foreshadowed'
  }

  if (action === 'advance') {
    return currentStatus === 'open' ? 'foreshadowed' : 'payoff-planned'
  }

  if (action === 'payoff') {
    return 'resolved'
  }

  return currentStatus
}

function mapHookActionToStatus(action: string | undefined, currentStatus: Hook['status']): Hook['status'] {
  if (action === 'foreshadow') {
    return 'foreshadowed'
  }

  if (action === 'advance') {
    return currentStatus === 'open' ? 'foreshadowed' : 'payoff-planned'
  }

  if (action === 'payoff') {
    return 'resolved'
  }

  return currentStatus
}

function buildLongTermCandidates(
  review: ReviewReport | null,
  chapterIndex: number,
  chapterTitle: string,
  chapterId: string,
): LongTermMemoryEntry[] {
  const base: LongTermMemoryEntry[] = [
    {
      summary: `第 ${chapterIndex} 章《${chapterTitle}》已成为当前主线正式内容`,
      importance: 4,
      sourceChapterId: chapterId,
    },
  ]

  if (!review) {
    return base
  }

  const closureBased = review.closureSuggestions.memory
    .filter((item) => item.memoryScope === 'long-term')
    .map((item) => ({
      summary: item.summary,
      importance: item.source === 'llm' ? 5 : 4,
      sourceChapterId: chapterId,
    }))

  const fallback = review.newFactCandidates.slice(0, 3).map((candidate, index) => ({
    summary: candidate,
    importance: index === 0 ? 5 : 4,
    sourceChapterId: chapterId,
  }))

  return [...base, ...(closureBased.length > 0 ? closureBased : fallback)]
}

function buildObservationEntries(
  closureSuggestions: ClosureSuggestions,
  previousEntries: Array<{ summary: string; sourceChapterId?: string }>,
  chapterId: string,
): Array<{ summary: string; sourceChapterId?: string }> {
  const nextEntries = closureSuggestions.memory
    .filter((item) => item.memoryScope === 'observation')
    .map((item) => ({
      summary: item.summary,
      sourceChapterId: chapterId,
    }))

  const merged = new Map<string, { summary: string; sourceChapterId?: string }>()

  for (const entry of [...previousEntries, ...nextEntries]) {
    merged.set(entry.summary, entry)
  }

  return [...merged.values()].slice(-10)
}

function buildShortTermSummaries(
  chapterIndex: number,
  chapterTitle: string,
  closureSuggestions: ClosureSuggestions,
): string[] {
  const derived = closureSuggestions.memory
    .filter((item) => item.memoryScope === 'short-term' || item.memoryScope === 'observation')
    .map((item) => item.memoryScope === 'observation' ? `待观察：${item.summary}` : item.summary)

  return derived.length > 0 ? derived : [`第 ${chapterIndex} 章《${chapterTitle}》终稿已确认`]
}

function buildShortTermEvents(
  chapterIndex: number,
  chapterTitle: string,
  closureSuggestions: ClosureSuggestions,
): string[] {
  const derived = closureSuggestions.memory
    .filter((item) => item.memoryScope === 'short-term' || item.memoryScope === 'observation')
    .map((item) => item.memoryScope === 'observation'
      ? `本章形成待观察事实：${item.summary}`
      : `本章确认短期事实：${item.summary}`)

  return derived.length > 0 ? derived : [`第 ${chapterIndex} 章《${chapterTitle}》终稿已确认`]
}

function buildShortTermMemoryReason(
  shortTermSuggestions: ClosureSuggestions['memory'],
  observationSuggestions: ClosureSuggestions['memory'],
): string {
  if (shortTermSuggestions.length > 0 && observationSuggestions.length > 0) {
    return `review 建议沉淀 ${shortTermSuggestions.length} 条短期事实，并保留 ${observationSuggestions.length} 条待观察事实`
  }

  if (shortTermSuggestions.length > 0) {
    return `review 建议沉淀 ${shortTermSuggestions.length} 条短期事实`
  }

  return `review 建议保留 ${observationSuggestions.length} 条待观察事实，暂不进入长期记忆`
}

function collectMemoryEvidence(
  suggestions: ClosureSuggestions['memory'],
): string[] {
  return suggestions
    .flatMap((item) => item.evidence.length > 0 ? item.evidence : [item.summary])
    .filter((item) => item.trim().length > 0)
    .slice(0, 5)
}

function formatCharacterUpdateSummary(
  characterId: string,
  previousState: CharacterCurrentState | undefined,
  nextLocationId: string | undefined,
  nextStatusNotes: string[],
  suggestion: ClosureSuggestions['characters'][number],
): string {
  return [
    `角色 ${characterId} 已按 review 建议更新`,
    `变更前=位置:${previousState?.currentLocationId ?? '未知'} / 状态:${previousState?.statusNotes.join(' / ') ?? '无'}`,
    `变更后=位置:${nextLocationId ?? '未知'} / 状态:${nextStatusNotes.join(' / ') || '无'}`,
    `原因=${suggestion.reason}`,
    `依据=${suggestion.evidence.join(' | ') || 'review closure suggestion'}`,
  ].join('；')
}

function formatItemUpdateSummary(
  itemName: string,
  previousState: ItemCurrentState | undefined,
  nextState: ItemCurrentState,
  suggestion: ClosureSuggestions['items'][number],
): string {
  return [
    `物品 ${itemName} 已按 review 建议更新`,
    `变更前=数量:${previousState?.quantity ?? '未知'} / 状态:${previousState?.status ?? '未知'} / 持有者:${previousState?.ownerCharacterId ?? '未知'} / 地点:${previousState?.locationId ?? '未知'}`,
    `变更后=数量:${nextState.quantity} / 状态:${nextState.status} / 持有者:${nextState.ownerCharacterId ?? '未知'} / 地点:${nextState.locationId ?? '未知'}`,
    `原因=${suggestion.reason}`,
    `依据=${suggestion.evidence.join(' | ') || 'review closure suggestion'}`,
  ].join('；')
}

function formatHookUpdateSummary(
  hookTitle: string,
  previousStatus: Hook['status'],
  nextStatus: Hook['status'],
  suggestion: ClosureSuggestions['hooks'][number],
): string {
  return [
    `Hook ${hookTitle} 已按 review 建议更新`,
    `变更前=${previousStatus}`,
    `变更后=${nextStatus}`,
    `原因=${suggestion.reason}`,
    `依据=${suggestion.evidence.join(' | ') || suggestion.actualOutcome}`,
  ].join('；')
}

function buildHookUpdateSummary(
  hookTitle: string,
  previousStatus: Hook['status'],
  nextStatus: Hook['status'],
  suggestion: ClosureSuggestions['hooks'][number] | undefined,
  explicitAction: string | undefined,
  planItem: HookPlan | undefined,
  hasFactEvidence: boolean,
): string {
  if (suggestion) {
    return formatHookUpdateSummary(hookTitle, previousStatus, nextStatus, suggestion)
  }

  if (explicitAction) {
    return `Hook ${hookTitle} 根据终稿显式动作 ${explicitAction} 更新，状态 ${previousStatus} -> ${nextStatus}`
  }

  if (hasFactEvidence && planItem) {
    return `Hook ${hookTitle} 在终稿中已被承接，按事实证据执行计划动作 ${planItem.action}，状态 ${previousStatus} -> ${nextStatus}`
  }

  if (planItem) {
    return `Hook ${hookTitle} 本章有计划 ${planItem.action}，但终稿未见事实承接，保持状态 ${nextStatus}`
  }

  return `Hook ${hookTitle} 保持当前状态 ${nextStatus}`
}

function buildHookTraceDetail(
  previousStatus: Hook['status'],
  nextStatus: Hook['status'],
  suggestion: ClosureSuggestions['hooks'][number] | undefined,
  explicitAction: string | undefined,
  planItem: HookPlan | undefined,
  structuredLine: string | null,
  textEvidence: string[],
): UpdateTraceDetail {
  if (suggestion) {
    return {
      source: 'closure-suggestion',
      reason: suggestion.reason,
      evidence: suggestion.evidence,
      evidenceSummary: suggestion.evidence.join(' | ') || suggestion.actualOutcome,
      before: previousStatus,
      after: nextStatus,
      previousValueSummary: `Hook 变更前=${previousStatus}`,
      nextValueSummary: `Hook 变更后=${nextStatus}`,
    }
  }

  if (explicitAction || structuredLine || textEvidence.length > 0) {
    return {
      source: 'structured-text',
      reason: explicitAction
        ? `终稿显式给出 Hook 动作 ${explicitAction}`
        : planItem
          ? `终稿已出现 Hook 事实承接，因此按计划动作 ${planItem.action} 推进`
          : '终稿已出现 Hook 事实承接',
      evidence: [structuredLine, ...textEvidence].filter(Boolean) as string[],
      evidenceSummary: [structuredLine, ...textEvidence].filter(Boolean).join(' | '),
      before: previousStatus,
      after: nextStatus,
      previousValueSummary: `Hook 变更前=${previousStatus}`,
      nextValueSummary: `Hook 变更后=${nextStatus}`,
    }
  }

  return {
    source: 'fallback',
    reason: planItem
      ? `本章计划存在 Hook 动作 ${planItem.action}，但终稿未出现足够事实证据，因此保持当前状态`
      : '未发现新的 Hook 事实，沿用当前状态',
    evidence: planItem?.note ? [planItem.note] : [],
    evidenceSummary: planItem?.note ?? '无新的 Hook 事实证据',
    before: previousStatus,
    after: nextStatus,
    previousValueSummary: `Hook 变更前=${previousStatus}`,
    nextValueSummary: `Hook 变更后=${nextStatus}`,
  }
}

function collectHookTextEvidence(
  content: string,
  hookId: string,
  hookTitle: string | undefined,
  planNote: string | undefined,
  hookDescription?: string,
  payoffExpectation?: string,
): string[] {
  const evidence: string[] = []

  if (content.includes(hookId)) {
    evidence.push(`正文提及 Hook ID ${hookId}`)
  }

  if (hookTitle && content.includes(hookTitle)) {
    evidence.push(`正文提及 Hook 标题 ${hookTitle}`)
  }

  for (const keyword of extractHookKeywords(hookDescription)) {
    if (content.includes(keyword)) {
      evidence.push(`正文提及 Hook 描述关键词 ${keyword}`)
      break
    }
  }

  for (const keyword of extractHookKeywords(payoffExpectation)) {
    if (content.includes(keyword)) {
      evidence.push(`正文提及 Hook 回收预期关键词 ${keyword}`)
      break
    }
  }

  if (planNote && content.includes(planNote)) {
    evidence.push(`正文提及计划说明 ${planNote}`)
  }

  return evidence.slice(0, 4)
}

function extractHookKeywords(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(/[，。；、,.;:!?（）()【】\[\]<>《》“”"'\-\/\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 5)
}

function buildCharacterTraceDetail(
  previousState: CharacterCurrentState | undefined,
  nextLocationId: string | undefined,
  nextStatusNotes: string[],
  suggestion: ClosureSuggestions['characters'][number] | undefined,
  explicitLocation: string | undefined,
  explicitStatus: string | undefined,
): UpdateTraceDetail {
  if (suggestion) {
    return {
      source: 'closure-suggestion',
      reason: suggestion.reason,
      evidence: suggestion.evidence,
      before: `位置=${previousState?.currentLocationId ?? '未知'}；状态=${previousState?.statusNotes.join(' / ') ?? '无'}`,
      after: `位置=${nextLocationId ?? '未知'}；状态=${nextStatusNotes.join(' / ') || '无'}`,
    }
  }

  if (explicitLocation || explicitStatus) {
    return {
      source: 'structured-text',
      reason: '终稿中包含显式结构化角色状态行',
      evidence: [explicitLocation, explicitStatus].filter(Boolean) as string[],
      before: `位置=${previousState?.currentLocationId ?? '未知'}；状态=${previousState?.statusNotes.join(' / ') ?? '无'}`,
      after: `位置=${nextLocationId ?? '未知'}；状态=${nextStatusNotes.join(' / ') || '无'}`,
    }
  }

  return {
    source: 'fallback',
    reason: '未发现新的结构化角色更新，沿用既有状态',
    evidence: [],
    before: `位置=${previousState?.currentLocationId ?? '未知'}；状态=${previousState?.statusNotes.join(' / ') ?? '无'}`,
    after: `位置=${nextLocationId ?? '未知'}；状态=${nextStatusNotes.join(' / ') || '无'}`,
  }
}

function buildItemTraceDetail(
  previousState: ItemCurrentState | undefined,
  nextState: ItemCurrentState,
  suggestion: ClosureSuggestions['items'][number] | undefined,
  explicitQuantity: string | undefined,
  explicitStatus: string | undefined,
  explicitOwner: string | undefined,
  explicitLocation: string | undefined,
): UpdateTraceDetail {
  if (suggestion) {
    return {
      source: 'closure-suggestion',
      reason: suggestion.reason,
      evidence: suggestion.evidence,
      before: formatItemState(previousState),
      after: formatItemState(nextState),
    }
  }

  if (explicitQuantity || explicitStatus || explicitOwner || explicitLocation) {
    return {
      source: 'structured-text',
      reason: '终稿中包含显式结构化物品状态行',
      evidence: [explicitQuantity, explicitStatus, explicitOwner, explicitLocation].filter(Boolean) as string[],
      before: formatItemState(previousState),
      after: formatItemState(nextState),
    }
  }

  return {
    source: 'fallback',
    reason: '未发现新的结构化物品更新，沿用既有状态',
    evidence: [],
    before: formatItemState(previousState),
    after: formatItemState(nextState),
  }
}

function formatItemState(state: ItemCurrentState | undefined): string {
  return `数量=${state?.quantity ?? '未知'}；状态=${state?.status ?? '未知'}；持有者=${state?.ownerCharacterId ?? '未知'}；地点=${state?.locationId ?? '未知'}`
}

function stateEvidence(shortTermSummaries: string[], shortTermEvents: string[]): string[] {
  return [...shortTermSummaries.slice(-2), ...shortTermEvents.slice(-2)]
}

function emptyClosureSuggestions(): ClosureSuggestions {
  return {
    characters: [],
    items: [],
    hooks: [],
    memory: [],
  }
}

function emptyOutcomeCandidate(decision: ReviewReport['decision']): ReviewReport['outcomeCandidate'] {
  return {
    decision,
    resolvedFacts: [],
    observationFacts: [],
    contradictions: [],
    narrativeDebts: [],
    characterArcProgress: [],
    hookDebtUpdates: [],
  }
}

function normalizeCharacterArcStage(value: string): 'setup' | 'rising' | 'crisis' | 'transform' | 'aftermath' {
  if (value === 'setup' || value === 'rising' || value === 'crisis' || value === 'transform' || value === 'aftermath') {
    return value
  }

  if (value === 'blocked') {
    return 'crisis'
  }

  if (value === 'advanced') {
    return 'rising'
  }

  return 'rising'
}

function mapPressureToScore(value: 'low' | 'medium' | 'high'): number {
  if (value === 'high') {
    return 90
  }

  if (value === 'medium') {
    return 60
  }

  return 30
}

function mapPressureToRiskLevel(value: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  return value
}

function mapPressureToWindow(value: 'low' | 'medium' | 'high'): number {
  if (value === 'high') {
    return 1
  }

  if (value === 'medium') {
    return 2
  }

  return 3
}
