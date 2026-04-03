import type {
  ClosureSuggestions,
  ContextItemView,
  LlmAdapter,
  ReviewDecision,
  ReviewReport,
  WordCountCheck,
} from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { extractJsonObject } from '../../shared/utils/json.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { NovelError } from '../../shared/utils/errors.js'

export class ReviewService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async reviewChapter(chapterId: string): Promise<ReviewReport> {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (!draft) {
      throw new NovelError('Draft is required before review. Run `novel write next <id>`.')
    }

    const plan = chapter.currentPlanVersionId
      ? this.chapterPlanRepository.getByVersionId(chapterId, chapter.currentPlanVersionId)
      : this.chapterPlanRepository.getLatestByChapterId(chapterId)

    if (!plan) {
      throw new NovelError('Chapter plan is missing for review.')
    }

    const wordCountCheck = createWordCountCheck(
      book.defaultChapterWordCount,
      draft.actualWordCount,
      book.chapterWordCountToleranceRatio,
    )

    const characterStates = this.characterCurrentStateRepository.listByBookId(book.id)
    const importantItems = this.itemCurrentStateRepository.listImportantByBookId(book.id)
    const longTermMemory = this.memoryRepository.getLongTermByBookId(book.id)
    const activeHookStates = this.hookStateRepository.listActiveByBookId(book.id)

    const baseReview = createRuleBasedReview(wordCountCheck, chapter.objective, draft.content, plan.sceneCards.length, plan.hookPlan.length)
    const aiReview = this.llmAdapter
      ? await createLlmReview(
          this.llmAdapter,
          wordCountCheck,
          chapter.title,
          chapter.objective,
          draft.content,
          plan.eventOutline,
          characterStates,
          importantItems,
          longTermMemory?.entries ?? [],
          activeHookStates,
        )
      : null
    const mergedReview = aiReview ?? baseReview
    const closureSuggestions = mergeClosureSuggestions(
      mergedReview.closureSuggestions,
      buildRuleBasedClosureSuggestions(
        chapter.objective,
        draft.content,
        characterStates,
        importantItems,
        longTermMemory?.entries ?? [],
        activeHookStates,
      ),
    )

    const review: ReviewReport = {
      id: createId('review'),
      bookId: book.id,
      chapterId,
      draftId: draft.id,
      decision: mergedReview.decision,
      consistencyIssues: mergedReview.consistencyIssues,
      characterIssues: mergeCharacterIssues(
        mergedReview.characterIssues,
        characterStates,
        plan.requiredCharacterIds,
        plan.requiredLocationIds,
        draft.content,
      ),
      itemIssues: mergeItemIssues(mergedReview.itemIssues, importantItems, draft.content, plan.requiredItemIds),
      memoryIssues: mergeMemoryIssues(mergedReview.memoryIssues, longTermMemory?.entries ?? [], draft.content),
      pacingIssues: mergedReview.pacingIssues,
      hookIssues: mergeHookIssues(mergedReview.hookIssues, activeHookStates, plan.hookPlan, draft.content),
      wordCountCheck,
      newFactCandidates: mergeNewFactCandidates(mergedReview.newFactCandidates, chapter.objective, plan.memoryCandidates),
      closureSuggestions,
      revisionAdvice: mergedReview.revisionAdvice,
      createdAt: nowIso(),
    }

    this.chapterReviewRepository.create(review)
    this.chapterRepository.markReviewed(chapterId, review.createdAt)

    return review
  }
}

function mergeCharacterIssues(
  baseIssues: string[],
  states: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>,
  requiredCharacterIds: string[],
  requiredLocationIds: string[],
  content: string,
): string[] {
  const issues = [...baseIssues]
  const relevantStates = states.filter(
    (state) => requiredCharacterIds.length === 0 || requiredCharacterIds.includes(state.characterId),
  )

  if (relevantStates.length > 0 && !content.includes('## 角色当前状态')) {
    issues.push('草稿未显式列出关键角色当前状态。')
  }

  for (const state of relevantStates) {
    const line = findStructuredLine(content, `角色（${state.characterId}）`)

    if (!line) {
      issues.push(`关键角色 ${state.characterId} 未在草稿中显式承接当前状态。`)
      continue
    }

    if (state.currentLocationId) {
      const explicitLocation = extractStructuredValue(line, '当前位置')

      if (explicitLocation && explicitLocation !== state.currentLocationId) {
        issues.push(`角色 ${state.characterId} 的当前位置与当前状态冲突：应为 ${state.currentLocationId}，草稿为 ${explicitLocation}。`)
      } else if (!line.includes(state.currentLocationId)) {
        issues.push(`角色 ${state.characterId} 的当前位置 ${state.currentLocationId} 未在草稿中得到承接。`)
      }
    }
  }

  for (const locationId of requiredLocationIds) {
    if (!content.includes(locationId)) {
      issues.push(`计划要求承接地点 ${locationId}，但草稿未显式体现。`)
    }
  }

  return uniqueMessages(issues)
}

function mergeHookIssues(
  baseIssues: string[],
  activeHookStates: Array<{ hookId: string; status: string }>,
  hookPlan: Array<{ hookId: string; action: string; note: string }>,
  content: string,
): string[] {
  const issues = [...baseIssues]

  if (activeHookStates.length > 0 && hookPlan.length === 0) {
    issues.push('存在活跃钩子，但本章计划未给出对应推进安排。')
  }

  if (activeHookStates.length > 0 && !content.includes('## 钩子约束')) {
    issues.push('草稿未显式承接当前活跃钩子。')
  }

  for (const item of hookPlan) {
    const line = findStructuredLine(content, `Hook（${item.hookId}）`)

    if (!line && !content.includes(item.note)) {
      issues.push(`计划要求处理 Hook ${item.hookId}，但草稿未体现对应承接。`)
      continue
    }

    const explicitAction = line ? extractStructuredValue(line, '动作') : undefined

    if (explicitAction && explicitAction !== item.action) {
      issues.push(`Hook ${item.hookId} 的草稿动作与计划不一致：计划=${item.action}，草稿=${explicitAction}。`)
    }
  }

  return uniqueMessages(issues)
}

function mergeItemIssues(
  baseIssues: string[],
  importantItems: ContextItemView[],
  content: string,
  requiredItemIds: string[],
): string[] {
  const issues = [...baseIssues]

  if (importantItems.length === 0) {
    return issues
  }

  const mentionedImportantItems = importantItems.filter((item) => content.includes(item.name) || content.includes(item.id))

  if (mentionedImportantItems.length === 0) {
    issues.push('当前存在关键物品，但正文没有显式承接任何关键物品状态。')
  }

  for (const requiredItemId of requiredItemIds) {
    const item = importantItems.find((candidate) => candidate.id === requiredItemId)

    if (!item) {
      continue
    }

    const line = findStructuredLine(content, `${item.name}（${item.id}）`)

    if (!line && !content.includes(item.name) && !content.includes(item.id)) {
      issues.push(`计划要求承接关键物品 ${item.name}，但正文未显式提及。`)
      continue
    }

    if (!line) {
      continue
    }

    const explicitQuantity = extractStructuredValue(line, '数量')
    const explicitStatus = extractStructuredValue(line, '状态')
    const explicitOwner = extractStructuredValue(line, '持有者')
    const explicitLocation = extractStructuredValue(line, '地点')

    if (explicitQuantity && Number.parseInt(explicitQuantity, 10) !== item.quantity) {
      issues.push(`关键物品 ${item.name} 的数量与当前状态冲突：应为 ${item.quantity}，草稿为 ${explicitQuantity}。`)
    }

    if (explicitStatus && explicitStatus !== item.status) {
      issues.push(`关键物品 ${item.name} 的状态与当前状态冲突：应为 ${item.status}，草稿为 ${explicitStatus}。`)
    }

    if (explicitOwner && item.ownerCharacterId && explicitOwner !== item.ownerCharacterId) {
      issues.push(`关键物品 ${item.name} 的持有者与当前状态冲突：应为 ${item.ownerCharacterId}，草稿为 ${explicitOwner}。`)
    }

    if (explicitLocation && item.locationId && explicitLocation !== item.locationId) {
      issues.push(`关键物品 ${item.name} 的地点与当前状态冲突：应为 ${item.locationId}，草稿为 ${explicitLocation}。`)
    }
  }

  return uniqueMessages(issues)
}

function mergeMemoryIssues(
  baseIssues: string[],
  longTermEntries: Array<{ summary: string; importance: number }>,
  content: string,
): string[] {
  const issues = [...baseIssues]
  const criticalEntries = longTermEntries.filter((entry) => entry.importance >= 4)

  if (criticalEntries.length > 0 && !content.includes('## 记忆约束')) {
    issues.push('草稿未显式承接高重要长期记忆。')
  }

  for (const entry of criticalEntries) {
    const sharedTokens = entry.summary
      .split(/[，。；、,\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)

    if (sharedTokens.some((token) => content.includes(`并非${token}`) || content.includes(`不是${token}`))) {
      issues.push(`正文可能与长期记忆冲突：${entry.summary}`)
    }
  }

  return uniqueMessages(issues)
}

function mergeNewFactCandidates(baseCandidates: string[], objective: string, memoryCandidates: string[]): string[] {
  const merged = [...baseCandidates]

  for (const candidate of [objective, ...memoryCandidates].slice(0, 3)) {
    if (!merged.includes(candidate)) {
      merged.push(candidate)
    }
  }

  return merged
}

function createRuleBasedReview(
  wordCountCheck: WordCountCheck,
  objective: string,
  content: string,
  sceneCardCount: number,
  hookPlanCount: number,
): Omit<ReviewReport, 'id' | 'bookId' | 'chapterId' | 'draftId' | 'wordCountCheck' | 'createdAt'> {
  const consistencyIssues = content.includes(objective) ? [] : ['草稿未明显呼应章节目标。']
  const pacingIssues = sceneCardCount < 2 ? ['场景拆分过少，节奏可能过于平。'] : []
  const hookIssues = hookPlanCount === 0 ? ['当前计划未显式记录钩子推进。'] : []
  const characterIssues: string[] = []
  const itemIssues: string[] = []
  const memoryIssues: string[] = []
  const newFactCandidates: string[] = []

  return {
    decision: decideReview(wordCountCheck, consistencyIssues, hookIssues),
    consistencyIssues,
    characterIssues,
    itemIssues,
    memoryIssues,
    pacingIssues,
    hookIssues,
    newFactCandidates,
    closureSuggestions: emptyClosureSuggestions(),
    revisionAdvice: buildRevisionAdvice(wordCountCheck, consistencyIssues, hookIssues, itemIssues),
  }
}

async function createLlmReview(
  llmAdapter: LlmAdapter,
  wordCountCheck: WordCountCheck,
  chapterTitle: string,
  objective: string,
  content: string,
  eventOutline: string[],
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>,
  importantItems: ContextItemView[],
  longTermEntries: Array<{ summary: string; importance: number }>,
  activeHookStates: Array<{ hookId: string; status: string }>,
): Promise<Omit<ReviewReport, 'id' | 'bookId' | 'chapterId' | 'draftId' | 'wordCountCheck' | 'createdAt'> | null> {
  try {
    const response = await llmAdapter.generateText({
      system: [
        '你是长篇小说章节审查助手。你要同时审查文本质量与状态一致性，而不是只做泛泛评价。',
        '必须优先检查：章节目标承接、事件是否落地、角色状态一致性、关键物品连续性、Hook 承接、长期记忆事实冲突、节奏与篇幅。',
        '请区分硬问题和软问题：会破坏主链路或状态闭环的问题必须更严厉。',
        '请输出 JSON，不要解释，不要使用 markdown 代码块。',
        'JSON 字段必须包含 decision, consistencyIssues, characterIssues, itemIssues, memoryIssues, pacingIssues, hookIssues, newFactCandidates, closureSuggestions, revisionAdvice。',
        'closureSuggestions 必须按 characters, items, hooks, memory 四组输出，每条建议都要包含 reason, evidence, source。',
        'revisionAdvice 必须可执行，尽量给出具体修正方向，而不是空泛评价。',
      ].join(' '),
      user: JSON.stringify(
        {
          task: {
            kind: 'chapter-review',
            chapterTitle,
            objective,
            reviewFocus: [
              '目标是否达成',
              '事件是否真正发生而不是被概述',
              '角色状态是否违背当前真源',
              '关键物品状态是否连续',
              'Hook 是否被承接或推进',
              '长期记忆是否被违背',
              '节奏与结尾牵引是否成立',
            ],
          },
          chapterPlan: {
            eventOutline,
          },
          stateConstraints: {
            characterStates,
            importantItems: importantItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              status: item.status,
              ownerCharacterId: item.ownerCharacterId,
              locationId: item.locationId,
            })),
            activeHookStates,
            criticalLongTermEntries: longTermEntries.filter((entry) => entry.importance >= 4),
          },
          wordCountCheck,
          draft: content,
        },
        null,
        2,
      ),
    })

    const parsed = JSON.parse(extractJsonObject(response.text)) as Partial<ReviewReport>

    return {
      decision: parsed.decision ?? 'warning',
      consistencyIssues: parsed.consistencyIssues ?? [],
      characterIssues: parsed.characterIssues ?? [],
      itemIssues: parsed.itemIssues ?? [],
      memoryIssues: parsed.memoryIssues ?? [],
      pacingIssues: parsed.pacingIssues ?? [],
      hookIssues: parsed.hookIssues ?? [],
      newFactCandidates: parsed.newFactCandidates ?? [],
      closureSuggestions: normalizeClosureSuggestions(parsed.closureSuggestions, 'llm'),
      revisionAdvice: parsed.revisionAdvice ?? ['建议人工复核本章审查结果。'],
    }
  } catch {
    return null
  }
}

function createWordCountCheck(target: number, actual: number, toleranceRatio: number): WordCountCheck {
  const deviationRatio = target === 0 ? 0 : Math.abs(actual - target) / target

  return {
    target,
    actual,
    toleranceRatio,
    deviationRatio,
    passed: deviationRatio <= toleranceRatio,
  }
}

function buildRevisionAdvice(
  wordCountCheck: WordCountCheck,
  consistencyIssues: string[],
  hookIssues: string[],
  itemIssues: string[],
): string[] {
  const advice: string[] = []

  if (!wordCountCheck.passed) {
    advice.push('优先调整篇幅，使内容更接近目标字数区间。')
  }

  if (consistencyIssues.length > 0) {
    advice.push('补强章节目标与正文事件之间的对应关系。')
  }

  if (hookIssues.length > 0) {
    advice.push('在结尾补入下一章牵引点或明确钩子推进。')
  }

  if (itemIssues.length > 0) {
    advice.push('补写关键物品的归属、状态或出场承接，避免后续断链。')
  }

  if (advice.length === 0) {
    advice.push('当前草稿可进入确认或轻量润色阶段。')
  }

  return advice
}

function decideReview(
  wordCountCheck: WordCountCheck,
  consistencyIssues: string[],
  hookIssues: string[],
): ReviewDecision {
  if (!wordCountCheck.passed || consistencyIssues.length > 0) {
    return 'needs-rewrite'
  }

  if (hookIssues.length > 0) {
    return 'warning'
  }

  return 'pass'
}

function buildRuleBasedClosureSuggestions(
  objective: string,
  content: string,
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>,
  importantItems: ContextItemView[],
  longTermEntries: Array<{ summary: string; importance: number }>,
  activeHookStates: Array<{ hookId: string; status: string }>,
): ClosureSuggestions {
  const suggestions = emptyClosureSuggestions()

  for (const state of characterStates) {
    const line = findStructuredLine(content, `角色（${state.characterId}）`)

    if (!line) {
      continue
    }

    suggestions.characters.push({
      characterId: state.characterId,
      nextLocationId: extractStructuredValue(line, '当前位置') ?? state.currentLocationId,
      nextStatusNotes: splitStructuredNotes(extractStructuredValue(line, '状态') ?? state.statusNotes.join('；')),
      reason: '草稿显式给出了角色状态承接。',
      evidence: [line],
      source: 'rule-based',
    })
  }

  for (const item of importantItems) {
    const line = findStructuredLine(content, `${item.name}（${item.id}）`)

    if (!line) {
      continue
    }

    const quantity = extractStructuredValue(line, '数量')

    suggestions.items.push({
      itemId: item.id,
      nextOwnerCharacterId: extractStructuredValue(line, '持有者') ?? item.ownerCharacterId,
      nextLocationId: extractStructuredValue(line, '地点') ?? item.locationId,
      nextQuantity: quantity ? Number.parseInt(quantity, 10) : item.quantity,
      nextStatus: extractStructuredValue(line, '状态') ?? item.status,
      reason: '草稿显式给出了关键物品状态承接。',
      evidence: [line],
      source: 'rule-based',
    })
  }

  for (const hook of activeHookStates) {
    const line = findStructuredLine(content, `Hook（${hook.hookId}）`)

    if (!line) {
      continue
    }

    const action = extractStructuredValue(line, '动作')

    suggestions.hooks.push({
      hookId: hook.hookId,
      nextStatus: mapHookActionToStatus(action, hook.status),
      actualOutcome: action ?? 'hold',
      reason: '草稿显式给出了 Hook 的本章处理结果。',
      evidence: [line],
      source: 'rule-based',
    })
  }

  for (const entry of longTermEntries.filter((item) => item.importance >= 4)) {
    if (!content.includes(entry.summary)) {
      continue
    }

    suggestions.memory.push({
      summary: entry.summary,
      memoryScope: 'long-term',
      reason: '草稿再次承接了高重要长期事实。',
      evidence: [entry.summary],
      source: 'rule-based',
    })
  }

  if (content.includes(objective)) {
    suggestions.memory.push({
      summary: objective,
      memoryScope: 'short-term',
      reason: '章节目标已在正文中得到直接承接。',
      evidence: [objective],
      source: 'rule-based',
    })
  }

  return suggestions
}

function mergeClosureSuggestions(
  primary: ClosureSuggestions,
  fallback: ClosureSuggestions,
): ClosureSuggestions {
  return {
    characters: primary.characters.length > 0 ? primary.characters : fallback.characters,
    items: primary.items.length > 0 ? primary.items : fallback.items,
    hooks: primary.hooks.length > 0 ? primary.hooks : fallback.hooks,
    memory: primary.memory.length > 0 ? primary.memory : fallback.memory,
  }
}

function normalizeClosureSuggestions(
  value: unknown,
  source: 'llm' | 'rule-based',
): ClosureSuggestions {
  const base = emptyClosureSuggestions()

  if (!value || typeof value !== 'object') {
    return base
  }

  const candidate = value as Partial<ClosureSuggestions>

  return {
    characters: Array.isArray(candidate.characters)
      ? candidate.characters.map((item) => ({
          characterId: String(item.characterId),
          nextLocationId: item.nextLocationId ? String(item.nextLocationId) : undefined,
          nextStatusNotes: Array.isArray(item.nextStatusNotes) ? item.nextStatusNotes.map((note) => String(note)) : [],
          reason: item.reason ? String(item.reason) : '模型识别到角色状态变化。',
          evidence: Array.isArray(item.evidence) ? item.evidence.map((entry) => String(entry)) : [],
          source,
        }))
      : [],
    items: Array.isArray(candidate.items)
      ? candidate.items.map((item) => ({
          itemId: String(item.itemId),
          nextOwnerCharacterId: item.nextOwnerCharacterId ? String(item.nextOwnerCharacterId) : undefined,
          nextLocationId: item.nextLocationId ? String(item.nextLocationId) : undefined,
          nextQuantity: typeof item.nextQuantity === 'number' ? item.nextQuantity : undefined,
          nextStatus: item.nextStatus ? String(item.nextStatus) : undefined,
          reason: item.reason ? String(item.reason) : '模型识别到物品状态变化。',
          evidence: Array.isArray(item.evidence) ? item.evidence.map((entry) => String(entry)) : [],
          source,
        }))
      : [],
    hooks: Array.isArray(candidate.hooks)
      ? candidate.hooks.map((item) => ({
          hookId: String(item.hookId),
          nextStatus: isHookStatus(item.nextStatus) ? item.nextStatus : 'open',
          actualOutcome: item.actualOutcome ? String(item.actualOutcome) : 'hold',
          reason: item.reason ? String(item.reason) : '模型识别到 Hook 处理结果。',
          evidence: Array.isArray(item.evidence) ? item.evidence.map((entry) => String(entry)) : [],
          source,
        }))
      : [],
    memory: Array.isArray(candidate.memory)
      ? candidate.memory.map((item) => ({
          summary: String(item.summary),
          memoryScope: isMemoryScope(item.memoryScope) ? item.memoryScope : 'observation',
          reason: item.reason ? String(item.reason) : '模型识别到可沉淀记忆。',
          evidence: Array.isArray(item.evidence) ? item.evidence.map((entry) => String(entry)) : [],
          source,
        }))
      : [],
  }
}

function emptyClosureSuggestions(): ClosureSuggestions {
  return {
    characters: [],
    items: [],
    hooks: [],
    memory: [],
  }
}

function mapHookActionToStatus(action: string | undefined, currentStatus: string): 'open' | 'foreshadowed' | 'payoff-planned' | 'resolved' {
  if (action === 'foreshadow') {
    return 'foreshadowed'
  }

  if (action === 'advance') {
    return 'payoff-planned'
  }

  if (action === 'payoff') {
    return 'resolved'
  }

  return isHookStatus(currentStatus) ? currentStatus : 'open'
}

function isHookStatus(value: unknown): value is 'open' | 'foreshadowed' | 'payoff-planned' | 'resolved' {
  return value === 'open' || value === 'foreshadowed' || value === 'payoff-planned' || value === 'resolved'
}

function isMemoryScope(value: unknown): value is 'long-term' | 'short-term' | 'observation' {
  return value === 'long-term' || value === 'short-term' || value === 'observation'
}

function findStructuredLine(content: string, label: string): string | null {
  return content.match(new RegExp(`^.*${escapeRegExp(label)}.*$`, 'm'))?.[0] ?? null
}

function extractStructuredValue(line: string, key: string): string | undefined {
  return line.match(new RegExp(`${escapeRegExp(key)}=([^；\n]+)`))?.[1]?.trim()
}

function splitStructuredNotes(value: string): string[] {
  return value
    .split(/[；;、，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueMessages(messages: string[]): string[] {
  return [...new Set(messages)]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
