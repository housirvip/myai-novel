import path from 'node:path'
import { writeFile } from 'node:fs/promises'

import type {
  ApproveResult,
  ChapterHookUpdate,
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
  ReviewReport,
  StoryState,
} from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import {
  buildCompletedChapterFilename,
  resolveProjectPaths,
} from '../../shared/utils/project-paths.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterRepository } from '../../infra/repository/character-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import type { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import type { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import type { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { ItemRepository } from '../../infra/repository/item-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { StoryStateRepository } from '../../infra/repository/story-state-repository.js'

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
    private readonly chapterOutputRepository: ChapterOutputRepository,
    private readonly chapterStateUpdateRepository: ChapterStateUpdateRepository,
    private readonly chapterMemoryUpdateRepository: ChapterMemoryUpdateRepository,
    private readonly chapterHookUpdateRepository: ChapterHookUpdateRepository,
    private readonly storyStateRepository: StoryStateRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly hookRepository: HookRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly itemRepository: ItemRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
  ) {}

  async approveChapter(chapterId: string): Promise<ApproveResult> {
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

    const plan = this.resolvePlan(chapterId, chapter.currentPlanVersionId)
    const review = this.chapterReviewRepository.getLatestByChapterId(chapterId)
    const closureSuggestions = review?.closureSuggestions ?? emptyClosureSuggestions()
    const source = this.resolveSource(chapterId)
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

    this.chapterOutputRepository.create(output)
    this.storyStateRepository.upsert(state)

    const hookUpdates = this.updateHookStates(book.id, chapterId, approvedAt, closureSuggestions, plan?.hookPlan ?? [])
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
    const previousLongTerm = this.memoryRepository.getLongTermByBookId(book.id)
    const nextShortTermSummaries = mergeRecentStrings(
      previousShortTerm?.summaries ?? [],
      buildShortTermSummaries(chapter.index, chapter.title, closureSuggestions),
      3,
    )
    const nextShortTermEvents = mergeRecentStrings(previousShortTerm?.recentEvents ?? [], state.recentEvents, 5)
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
      nextShortTermSummaries,
      nextShortTermEvents,
      nextLongTermEntries,
      closureSuggestions,
    )

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
      approvedAt,
    }
  }

  private updateHookStates(
    bookId: string,
    chapterId: string,
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
      const nextStatus = suggestion?.nextStatus ?? (planItem ? transitionHookStatus(currentStatus, planItem.action) : currentStatus)

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
        summary: suggestion
          ? formatHookUpdateSummary(hook?.title ?? hookId, currentStatus, nextStatus, suggestion)
          : planItem
            ? `Hook ${hook?.title ?? hookId} 按计划执行 ${planItem.action}，状态 ${currentStatus} -> ${nextStatus}`
            : `Hook ${hook?.title ?? hookId} 保持当前状态 ${nextStatus}`,
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
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private buildMemoryUpdates(
    bookId: string,
    chapterId: string,
    createdAt: string,
    shortTermSummaries: string[],
    shortTermEvents: string[],
    longTermEntries: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
    closureSuggestions: ClosureSuggestions,
  ): ChapterMemoryUpdate[] {
    const latestShortTerm = closureSuggestions.memory.find((item) => item.memoryScope === 'short-term')
    const latestLongTerm = closureSuggestions.memory.find((item) => item.memoryScope === 'long-term')

    return [
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'short-term',
        summary: latestShortTerm
          ? `短期记忆已更新：新增=${latestShortTerm.summary}；原因=${latestShortTerm.reason}`
          : `短期记忆已更新：${shortTermSummaries.at(-1) ?? shortTermEvents.at(-1) ?? '最近事件窗口已刷新'}`,
        createdAt,
      },
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'long-term',
        summary: latestLongTerm
          ? `长期记忆已更新：新增=${latestLongTerm.summary}；原因=${latestLongTerm.reason}`
          : `长期记忆已更新：${longTermEntries[0]?.summary ?? '高重要事实集合已刷新'}`,
        createdAt,
      },
    ]
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

  private resolveSource(chapterId: string): DraftSource {
    const rewrite = this.chapterRewriteRepository.getLatestByChapterId(chapterId)

    if (rewrite) {
      return mapRewriteSource(rewrite)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (!draft) {
      throw new NovelError('No draft or rewrite candidate found for approval.')
    }

    return {
      sourceType: 'draft',
      sourceId: draft.id,
      versionId: draft.versionId,
      content: draft.content,
    }
  }

  private resolvePlan(chapterId: string, currentPlanVersionId?: string): ChapterPlan | null {
    if (currentPlanVersionId) {
      const versionedPlan = this.chapterPlanRepository.getByVersionId(chapterId, currentPlanVersionId)

      if (versionedPlan) {
        return versionedPlan
      }
    }

    return this.chapterPlanRepository.getLatestByChapterId(chapterId)
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

function buildShortTermSummaries(
  chapterIndex: number,
  chapterTitle: string,
  closureSuggestions: ClosureSuggestions,
): string[] {
  const derived = closureSuggestions.memory
    .filter((item) => item.memoryScope === 'short-term' || item.memoryScope === 'observation')
    .map((item) => item.summary)

  return derived.length > 0 ? derived : [`第 ${chapterIndex} 章《${chapterTitle}》终稿已确认`]
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

function emptyClosureSuggestions(): ClosureSuggestions {
  return {
    characters: [],
    items: [],
    hooks: [],
    memory: [],
  }
}
