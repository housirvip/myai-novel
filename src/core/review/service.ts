import type {
  ClosureSuggestions,
  ContextItemView,
  Hook,
  LlmAdapter,
  ReviewDecision,
  ReviewReport,
  WordCountCheck,
} from '../../shared/types/domain.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import { createId } from '../../shared/utils/id.js'
import { extractJsonObject } from '../../shared/utils/json.js'
import { NovelError } from '../../shared/utils/errors.js'
import { nowIso } from '../../shared/utils/time.js'

export class ReviewService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly characterArcRepository: CharacterArcRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly hookRepository: HookRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly hookPressureRepository: HookPressureRepository,
    private readonly narrativeDebtRepository: NarrativeDebtRepository,
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

    if (!chapter.currentVersionId) {
      throw new NovelError('Current draft chain is missing. Run `novel write next <id>`.')
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (!draft) {
      throw new NovelError('Draft is required before review. Run `novel write next <id>`.')
    }

    if (!chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing for review.')
    }

    const plan = this.chapterPlanRepository.getByVersionId(chapterId, chapter.currentPlanVersionId)

    if (!plan) {
      throw new NovelError('Current chapter plan is missing for review.')
    }

    const wordCountCheck = createWordCountCheck(
      book.defaultChapterWordCount,
      draft.actualWordCount,
      book.chapterWordCountToleranceRatio,
    )

    const characterStates = this.characterCurrentStateRepository.listByBookId(book.id)
    const characterArcs = this.characterArcRepository.listByBookId(book.id)
    const importantItems = this.itemCurrentStateRepository.listImportantByBookId(book.id)
    const longTermMemory = this.memoryRepository.getLongTermByBookId(book.id)
    const activeHookStates = this.hookStateRepository.listActiveByBookId(book.id)
    const hookPressures = this.hookPressureRepository.listActiveByBookId(book.id)
    const openNarrativeDebts = this.narrativeDebtRepository.listOpenByBookId(book.id)
    const hooks = this.hookRepository.listByBookId(book.id)

    const baseReview = createRuleBasedReview(wordCountCheck, chapter.objective, draft.content, plan.sceneCards.length, plan.hookPlan.length)
    const aiReview = this.llmAdapter
      ? await createLlmReview(
          this.llmAdapter,
          wordCountCheck,
          chapter.title,
          chapter.objective,
          draft.content,
          plan.sceneCards,
          plan.sceneGoals,
          plan.sceneConstraints,
          plan.sceneEmotionalTargets,
          plan.sceneOutcomeChecklist,
          plan.eventOutline,
          plan.statePredictions,
          plan.hookPlan,
          plan.endingDrive,
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
        plan.hookPlan,
        hooks,
      ),
    )

    const characterIssues = mergeCharacterIssues(
      mergedReview.characterIssues,
      characterStates,
      plan.requiredCharacterIds,
      plan.requiredLocationIds,
      draft.content,
    )
    const itemIssues = mergeItemIssues(mergedReview.itemIssues, importantItems, draft.content, plan.requiredItemIds)
    const memoryIssues = mergeMemoryIssues(mergedReview.memoryIssues, longTermMemory?.entries ?? [], draft.content)
    const endingReadinessIssues = mergeEndingReadinessIssues(plan, draft.content)
    const consistencyIssues = uniqueMessages([
      ...mergedReview.consistencyIssues,
      ...mergeSceneExecutionIssues(plan.sceneGoals, plan.sceneOutcomeChecklist, draft.content),
    ])
    const hookIssues = uniqueMessages([
      ...mergeHookIssues(mergedReview.hookIssues, activeHookStates, plan.hookPlan, draft.content),
      ...mergePressureHookIssues(hookPressures, plan.highPressureHookIds, draft.content),
      ...mergeEndingDriveIssues(plan.endingDrive, draft.content),
    ])
    const missionProgress = evaluateMissionProgress(plan, draft.content)
    const threadIssues = uniqueMessages([
      ...mergeMissionIssues(plan, missionProgress),
      ...mergeThreadFocusIssues(plan.threadFocus, draft.content),
      ...mergeEnsembleBalanceIssues(plan.ensembleFocusCharacterIds, plan.subplotCarryThreadIds, draft.content),
    ])
    const characterIssuesWithArc = uniqueMessages([
      ...characterIssues,
      ...mergeArcIssues(characterArcs, plan.characterArcTargets, draft.content),
    ])
    const pacingIssues = uniqueMessages([
      ...mergedReview.pacingIssues,
      ...mergeDebtCarryIssues(plan.debtCarryTargets, openNarrativeDebts, draft.content),
      ...mergeEmotionalProgressionIssues(plan.sceneEmotionalTargets, draft.content),
    ])

    const newFactCandidates = mergeNewFactCandidates(
      mergedReview.newFactCandidates,
      chapter.objective,
      plan.memoryCandidates,
    )
    const outcomeCandidate = buildOutcomeCandidate({
      decision: mergedReview.decision,
      chapterObjective: chapter.objective,
      newFactCandidates,
      closureSuggestions,
      consistencyIssues,
      characterIssues: characterIssuesWithArc,
      itemIssues,
      memoryIssues,
      hookIssues: uniqueMessages([...hookIssues, ...threadIssues, ...endingReadinessIssues]),
      pacingIssues,
      activeHookStates,
      characterStates,
    })
    const reviewLayers = buildReviewLayers({
      wordCountCheck,
      consistencyIssues,
      characterIssues: characterIssuesWithArc,
      itemIssues,
      memoryIssues,
      pacingIssues,
      hookIssues: uniqueMessages([...hookIssues, ...threadIssues, ...endingReadinessIssues]),
      revisionAdvice: mergedReview.revisionAdvice,
    })

    const review: ReviewReport = {
      id: createId('review'),
      bookId: book.id,
      chapterId,
      draftId: draft.id,
      decision: mergedReview.decision,
      consistencyIssues,
      characterIssues: characterIssuesWithArc,
      itemIssues,
      memoryIssues,
      pacingIssues,
      hookIssues,
      threadIssues,
      endingReadinessIssues,
      missionProgress,
      reviewLayers,
      approvalRisk: deriveApprovalRisk(
        mergedReview.decision,
        consistencyIssues,
        characterIssuesWithArc,
        itemIssues,
        memoryIssues,
        hookIssues,
      ),
      wordCountCheck,
      newFactCandidates,
      closureSuggestions,
      outcomeCandidate,
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

/**
 * mission progress 判定是 `v4` review 的关键桥梁：
 *
 * 它不要求正文逐字复述 plan，而是检查正文是否留下了足够证据，证明：
 * - 当前章确实承接了 thread focus
 * - 计划中的关键事件不是停留在提纲层
 * - carry in / carry out 任务已经进入正文事实
 */
function evaluateMissionProgress(
  plan: { missionId?: string; threadFocus: string[]; eventOutline: string[]; carryInTasks: string[]; carryOutTasks: string[] },
  content: string,
): ReviewReport['missionProgress'] {
  if (!plan.missionId) {
    return {
      status: 'not-applicable',
      evidence: [],
    }
  }

  const evidence = [...new Set([
    ...plan.threadFocus.filter((item) => content.includes(item)),
    ...plan.eventOutline.filter((item) => item.length > 0 && content.includes(item)),
    ...plan.carryInTasks.filter((item) => item.length > 0 && content.includes(item)),
    ...plan.carryOutTasks.filter((item) => item.length > 0 && content.includes(item)),
  ])]

  const status = evidence.length >= 2
    ? 'completed'
    : (evidence.length === 1 ? 'partial' : 'missing')

  return {
    missionId: plan.missionId,
    missionSummary: plan.carryInTasks[0] ?? plan.eventOutline[0],
    status,
    evidence,
  }
}

/**
 * mission issue 不是普通文风意见，而是“当前章偏离卷级职责”的硬警告。
 *
 * 一旦这里报错，后续 rewrite / doctor 都会把它视为优先修复对象。
 */
function mergeMissionIssues(
  plan: { missionId?: string; carryInTasks: string[]; carryOutTasks: string[] },
  missionProgress: ReviewReport['missionProgress'],
): string[] {
  if (!plan.missionId || missionProgress.status === 'not-applicable') {
    return []
  }

  if (missionProgress.status === 'completed') {
    return []
  }

  const target = plan.carryInTasks[0] ?? plan.carryOutTasks[0] ?? plan.missionId
  return [
    missionProgress.status === 'partial'
      ? `卷级 mission 承接不足：${target}`
      : `卷级 mission 未得到有效推进：${target}`,
  ]
}

/**
 * thread focus issue 用于识别“主线没有真正进正文”的情况。
 *
 * 这里保持规则简单直接：只要高优线程标识完全未被正文承接，就先给出明确警报，
 * 后续再由 rewrite / doctor 进一步细化处理。
 */
function mergeThreadFocusIssues(threadFocus: string[], content: string): string[] {
  return threadFocus
    .filter((threadId) => !content.includes(threadId))
    .map((threadId) => `高优先级线程 ${threadId} 本章未形成明确承接。`)
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

  const decision = decideReview(wordCountCheck, consistencyIssues, hookIssues)

  return {
    decision,
    consistencyIssues,
    characterIssues,
    itemIssues,
    memoryIssues,
    pacingIssues,
    hookIssues,
    threadIssues: [],
    endingReadinessIssues: [],
    missionProgress: {
      status: 'not-applicable',
      evidence: [],
    },
    reviewLayers: emptyReviewLayers(),
    approvalRisk: deriveApprovalRisk(decision, consistencyIssues, characterIssues, itemIssues, memoryIssues, hookIssues),
    newFactCandidates,
    closureSuggestions: emptyClosureSuggestions(),
    outcomeCandidate: {
      decision,
      resolvedFacts: [],
      observationFacts: [],
      contradictions: [],
      narrativeDebts: [],
      characterArcProgress: [],
      hookDebtUpdates: [],
    },
    revisionAdvice: buildRevisionAdvice(wordCountCheck, consistencyIssues, hookIssues, itemIssues),
  }
}

async function createLlmReview(
  llmAdapter: LlmAdapter,
  wordCountCheck: WordCountCheck,
  chapterTitle: string,
  objective: string,
  content: string,
  sceneCards: Array<{ title: string; purpose: string; beats: string[]; characterIds: string[]; locationId?: string; factionIds: string[]; itemIds: string[] }>,
  sceneGoals: Array<{ sceneTitle: string; conflict: string; informationReveal: string; emotionalShift: string }>,
  sceneConstraints: Array<{ sceneTitle: string; mustInclude: string[]; mustAvoid: string[]; protectedFacts: string[] }>,
  sceneEmotionalTargets: Array<{ sceneTitle: string; startingEmotion: string; targetEmotion: string; intensity: string }>,
  sceneOutcomeChecklist: Array<{ sceneTitle: string; mustHappen: string[]; shouldAdvanceHooks: string[]; shouldResolveDebts: string[] }>,
  eventOutline: string[],
  statePredictions: string[],
  hookPlan: Array<{ hookId: string; action: string; note: string }>,
  endingDrive: string,
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>,
  importantItems: ContextItemView[],
  longTermEntries: Array<{ summary: string; importance: number }>,
  activeHookStates: Array<{ hookId: string; status: string }>,
): Promise<Omit<ReviewReport, 'id' | 'bookId' | 'chapterId' | 'draftId' | 'wordCountCheck' | 'createdAt'> | null> {
  try {
    const response = await llmAdapter.generateText({
      system: [
        '你是长篇小说章节审查助手。你要同时审查文本质量、结构执行度与状态一致性，而不是只做泛泛评价。',
        '必须优先检查：章节目标承接、scene 是否落地、事件是否真正发生、角色状态一致性、关键物品连续性、Hook 实际处理结果、长期记忆事实冲突、节奏与篇幅。',
        '还必须检查：sceneGoals 是否真正兑现、endingDrive 是否在结尾形成牵引、sceneEmotionalTargets 是否体现出情绪推进。',
        '请区分硬问题和软问题：会破坏主链路、状态闭环或后续 approve 的问题必须更严厉，并优先写在对应 issues 数组前面。',
        'closureSuggestions 是给 approve 使用的结构化闭环建议，不要只报问题；要尽量回答哪些事实已确认、哪些 Hook 实际推进、哪些事实只能暂时观察。',
        '如果计划要求推进 Hook、状态或事件，但正文没有足够事实承接，必须在 hookIssues / consistencyIssues 中明确指出。',
        '请输出 JSON，不要解释，不要使用 markdown 代码块。',
        'JSON 字段必须包含 decision, consistencyIssues, characterIssues, itemIssues, memoryIssues, pacingIssues, hookIssues, newFactCandidates, closureSuggestions, revisionAdvice。',
        'decision 只能是 pass, warning, needs-rewrite。',
        'closureSuggestions 必须按 characters, items, hooks, memory 四组输出，每条建议都要包含 reason, evidence, source。',
        'revisionAdvice 必须可执行，优先给出必须修的问题，不要写空泛评价。',
      ].join(' '),
      user: JSON.stringify(
        {
          task: {
            kind: 'chapter-review',
            chapterTitle,
            objective,
            reviewFocus: [
              '目标是否达成',
              'scene 与 eventOutline 是否真正落地',
              'sceneGoals 与结果清单是否兑现',
              '角色状态是否违背当前真源',
              '关键物品状态是否连续',
              'Hook 是否被承接、推进、搁置或完成',
              '长期记忆是否被违背',
              '节奏、情绪推进与结尾牵引是否成立',
            ],
            outputPriority: [
              '先指出会破坏状态闭环的问题',
              '再指出结构执行偏差',
              '最后给出可执行修订建议',
            ],
          },
          chapterPlan: {
            sceneCards,
            sceneGoals,
            sceneConstraints,
            sceneEmotionalTargets,
            sceneOutcomeChecklist,
            eventOutline,
            statePredictions,
            hookPlan,
            endingDrive,
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
            protectedFacts: buildProtectedFactHints(characterStates, importantItems, longTermEntries, activeHookStates),
          },
          wordCountCheck,
          draft: content,
        },
        null,
        2,
      ),
    })

    const parsed = JSON.parse(extractJsonObject(response.text)) as Partial<ReviewReport>

    const decision = parsed.decision ?? 'warning'
    const consistencyIssues = normalizeIssueArray(parsed.consistencyIssues)
    const characterIssues = normalizeIssueArray(parsed.characterIssues)
    const itemIssues = normalizeIssueArray(parsed.itemIssues)
    const memoryIssues = normalizeIssueArray(parsed.memoryIssues)
    const pacingIssues = normalizeIssueArray(parsed.pacingIssues)
    const hookIssues = normalizeIssueArray(parsed.hookIssues)
    const newFactCandidates = normalizeFactCandidates(parsed.newFactCandidates)
    const revisionAdvice = normalizeRevisionAdvice(parsed.revisionAdvice)

    return {
      decision,
      consistencyIssues,
      characterIssues,
      itemIssues,
      memoryIssues,
      pacingIssues,
      hookIssues,
      threadIssues: [],
      endingReadinessIssues: [],
      missionProgress: {
        status: 'not-applicable',
        evidence: [],
      },
      reviewLayers: emptyReviewLayers(),
      approvalRisk: deriveApprovalRisk(decision, consistencyIssues, characterIssues, itemIssues, memoryIssues, hookIssues),
      newFactCandidates,
      closureSuggestions: normalizeClosureSuggestions(parsed.closureSuggestions, 'llm'),
      outcomeCandidate: {
        decision,
        resolvedFacts: [],
        observationFacts: [],
        contradictions: [],
        narrativeDebts: [],
        characterArcProgress: [],
        hookDebtUpdates: [],
      },
      revisionAdvice: revisionAdvice.length > 0 ? revisionAdvice : ['建议人工复核本章审查结果。'],
    }
  } catch {
    return null
  }
}

function normalizeIssueArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeReviewText(item))
    .filter((item) => item.length > 0)
}

function normalizeFactCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeReviewText(item, ['fact', 'summary', 'content', 'description', 'source']))
    .filter((entry) => entry.length > 0)
}

function normalizeRevisionAdvice(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeReviewText(item, ['action', 'detail', 'description', 'suggestion', 'content']))
    .filter((entry) => entry.length > 0)
}

function normalizeReviewText(value: unknown, preferredKeys?: string[]): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const candidate = value as Record<string, unknown>
  const keys = preferredKeys ?? ['summary', 'content', 'description', 'suggestion', 'fact', 'action', 'detail', 'location']
  const parts = keys
    .map((key) => candidate[key])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())

  return [...new Set(parts)].join('；')
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

function buildProtectedFactHints(
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>,
  importantItems: ContextItemView[],
  longTermEntries: Array<{ summary: string; importance: number }>,
  activeHookStates: Array<{ hookId: string; status: string }>,
): string[] {
  return [
    ...characterStates.slice(0, 3).map((item) => `角色 ${item.characterId}：位置=${item.currentLocationId ?? '未知'}；状态=${item.statusNotes.join(' / ') || '无'}`),
    ...importantItems.slice(0, 3).map((item) => `物品 ${item.id}：状态=${item.status}；持有者=${item.ownerCharacterId ?? '未知'}；地点=${item.locationId ?? '未知'}`),
    ...activeHookStates.slice(0, 3).map((item) => `Hook ${item.hookId}：当前状态=${item.status}`),
    ...longTermEntries.filter((item) => item.importance >= 4).slice(0, 3).map((item) => `长期事实：${item.summary}`),
  ]
}

function deriveApprovalRisk(
  decision: ReviewDecision,
  consistencyIssues: string[],
  characterIssues: string[],
  itemIssues: string[],
  memoryIssues: string[],
  hookIssues: string[],
): 'low' | 'medium' | 'high' {
  if (decision === 'needs-rewrite') {
    return 'high'
  }

  const hardIssueCount =
    consistencyIssues.length +
    characterIssues.length +
    itemIssues.length +
    memoryIssues.length +
    hookIssues.length

  if (hardIssueCount >= 3) {
    return 'high'
  }

  if (decision === 'warning' || hardIssueCount > 0) {
    return 'medium'
  }

  return 'low'
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
  hookPlan: Array<{ hookId: string; action: string; note: string }>,
  hooks: Hook[],
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

  const activeHookStatusById = new Map(activeHookStates.map((hook) => [hook.hookId, hook.status]))
  const hookPlanById = new Map(hookPlan.map((item) => [item.hookId, item]))
  const hookById = new Map(hooks.map((hook) => [hook.id, hook]))
  const targetHookIds = uniqueStrings([
    ...activeHookStates.map((hook) => hook.hookId),
    ...hookPlan.map((item) => item.hookId),
  ])

  for (const hookId of targetHookIds) {
    const currentStatus = normalizeHookStatus(activeHookStatusById.get(hookId))
    const line = findStructuredLine(content, `Hook（${hookId}）`)
    const action = line ? extractStructuredValue(line, '动作') : undefined
    const planItem = hookPlanById.get(hookId)
    const hook = hookById.get(hookId)
    const textEvidence = collectHookEvidence(
      content,
      hookId,
      hook?.title,
      hook?.description,
      hook?.payoffExpectation,
      planItem?.note,
    )

    if (line && action) {
      suggestions.hooks.push({
        hookId,
        nextStatus: mapHookActionToStatus(action, currentStatus),
        actualOutcome: action,
        reason: '草稿显式给出了 Hook 的本章处理结果。',
        evidence: [line],
        source: 'rule-based',
      })
      continue
    }

    if (textEvidence.length > 0 && planItem) {
      suggestions.hooks.push({
        hookId,
        nextStatus: mapHookActionToStatus(planItem.action, currentStatus),
        actualOutcome: planItem.action,
        reason: '正文已出现 Hook 承接证据，结合本章计划推断其实际推进结果。',
        evidence: textEvidence,
        source: 'rule-based',
      })
      continue
    }

    if (planItem) {
      suggestions.hooks.push({
        hookId,
        nextStatus: currentStatus,
        actualOutcome: 'hold',
        reason: `本章计划要求执行 ${planItem.action}，但正文未见足够承接证据，因此暂不推进 Hook 状态。`,
        evidence: [planItem.note],
        source: 'rule-based',
      })
    }
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
      ? candidate.characters
          .map((item) => {
            const characterId = normalizeEntityId(item.characterId)

            if (!characterId) {
              return null
            }

            return {
              characterId,
              nextLocationId: normalizeOptionalText(item.nextLocationId),
              nextStatusNotes: Array.isArray(item.nextStatusNotes)
                ? item.nextStatusNotes
                    .map((note) => normalizeReviewText(note))
                    .filter((note) => note.length > 0)
                : [],
              reason: normalizeReviewText(item.reason) || '模型识别到角色状态变化。',
              evidence: Array.isArray(item.evidence)
                ? item.evidence.map((entry) => normalizeReviewText(entry)).filter((entry) => entry.length > 0)
                : [],
              source,
            }
          })
          .filter(isDefined)
      : [],
    items: Array.isArray(candidate.items)
      ? candidate.items
          .map((item) => {
            const itemId = normalizeEntityId(item.itemId)

            if (!itemId) {
              return null
            }

            return {
              itemId,
              nextOwnerCharacterId: normalizeOptionalText(item.nextOwnerCharacterId),
              nextLocationId: normalizeOptionalText(item.nextLocationId),
              nextQuantity: typeof item.nextQuantity === 'number' ? item.nextQuantity : undefined,
              nextStatus: normalizeOptionalText(item.nextStatus),
              reason: normalizeReviewText(item.reason) || '模型识别到物品状态变化。',
              evidence: Array.isArray(item.evidence)
                ? item.evidence.map((entry) => normalizeReviewText(entry)).filter((entry) => entry.length > 0)
                : [],
              source,
            }
          })
          .filter(isDefined)
      : [],
    hooks: Array.isArray(candidate.hooks)
      ? candidate.hooks
          .map((item) => {
            const hookId = normalizeEntityId(item.hookId)

            if (!hookId) {
              return null
            }

            return {
              hookId,
              nextStatus: isHookStatus(item.nextStatus) ? item.nextStatus : 'open',
              actualOutcome: normalizeOptionalText(item.actualOutcome) ?? 'hold',
              reason: normalizeReviewText(item.reason) || '模型识别到 Hook 处理结果。',
              evidence: Array.isArray(item.evidence)
                ? item.evidence.map((entry) => normalizeReviewText(entry)).filter((entry) => entry.length > 0)
                : [],
              source,
            }
          })
          .filter(isDefined)
      : [],
    memory: Array.isArray(candidate.memory)
      ? candidate.memory
          .map((item) => {
            const summary = normalizeReviewText(item.summary, ['summary', 'content', 'fact', 'description'])

            if (!summary) {
              return null
            }

            return {
              summary,
              memoryScope: isMemoryScope(item.memoryScope) ? item.memoryScope : 'observation',
              reason: normalizeReviewText(item.reason) || '模型识别到可沉淀记忆。',
              evidence: Array.isArray(item.evidence)
                ? item.evidence.map((entry) => normalizeReviewText(entry)).filter((entry) => entry.length > 0)
                : [],
              source,
            }
          })
          .filter(isDefined)
      : [],
  }
}

function normalizeEntityId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 && normalized !== 'undefined' ? normalized : null
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 && normalized !== 'undefined' ? normalized : undefined
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null
}

function emptyClosureSuggestions(): ClosureSuggestions {
  return {
    characters: [],
    items: [],
    hooks: [],
    memory: [],
  }
}

function emptyReviewLayers(): ReviewReport['reviewLayers'] {
  return {
    mustFix: [],
    narrativeQuality: [],
    languageQuality: [],
    rewriteStrategySuggestion: {
      primary: 'consistency-first',
      secondary: [],
      rationale: ['当前尚未生成分层 review 策略建议。'],
    },
  }
}

function buildReviewLayers(input: {
  wordCountCheck: WordCountCheck
  consistencyIssues: string[]
  characterIssues: string[]
  itemIssues: string[]
  memoryIssues: string[]
  pacingIssues: string[]
  hookIssues: string[]
  revisionAdvice: string[]
}): ReviewReport['reviewLayers'] {
  const mustFix = [
    ...input.consistencyIssues.map((summary) => ({ category: 'consistency' as const, severity: 'critical' as const, summary })),
    ...input.characterIssues.map((summary) => ({ category: 'state' as const, severity: 'high' as const, summary })),
    ...input.itemIssues.map((summary) => ({ category: 'state' as const, severity: 'high' as const, summary })),
    ...input.memoryIssues.map((summary) => ({ category: 'state' as const, severity: 'high' as const, summary })),
    ...input.hookIssues.map((summary) => ({ category: 'hook' as const, severity: 'high' as const, summary })),
  ]

  const narrativeQuality = [
    ...input.pacingIssues.map((summary) => ({ category: 'pacing' as const, severity: 'medium' as const, summary })),
    ...input.hookIssues
      .filter((summary) => summary.includes('结尾') || summary.includes('牵引'))
      .map((summary) => ({ category: 'ending-drive' as const, severity: 'high' as const, summary })),
    ...input.pacingIssues
      .filter((summary) => summary.includes('情绪'))
      .map((summary) => ({ category: 'emotion' as const, severity: 'medium' as const, summary })),
    ...input.characterIssues
      .filter((summary) => summary.includes('弧线'))
      .map((summary) => ({ category: 'arc' as const, severity: 'medium' as const, summary })),
    ...input.pacingIssues
      .filter((summary) => summary.includes('债务'))
      .map((summary) => ({ category: 'debt' as const, severity: 'medium' as const, summary })),
  ]

  const languageQuality = [
    ...(!input.wordCountCheck.passed
      ? [{ category: 'clarity' as const, severity: 'medium' as const, summary: '篇幅偏离目标区间，影响正文表达密度。' }]
      : []),
    ...input.revisionAdvice
      .filter((summary) => summary.includes('润色') || summary.includes('摘要') || summary.includes('对话'))
      .map((summary) => ({ category: 'style' as const, severity: 'low' as const, summary })),
  ]

  const primary = input.consistencyIssues.length > 0 || input.characterIssues.length > 0 || input.itemIssues.length > 0 || input.memoryIssues.length > 0
    ? 'consistency-first'
    : (!input.wordCountCheck.passed
        ? 'length-correction'
        : (input.hookIssues.some((summary) => summary.includes('结尾') || summary.includes('牵引'))
            ? 'ending-drive-first'
            : (input.pacingIssues.some((summary) => summary.includes('情绪')) ? 'emotion-enhance' : 'pacing-first')))

  const secondary = [
    ...(primary !== 'consistency-first' && mustFix.length > 0 ? ['consistency-first' as const] : []),
    ...(primary !== 'ending-drive-first' && narrativeQuality.some((item) => item.category === 'ending-drive') ? ['ending-drive-first' as const] : []),
    ...(primary !== 'emotion-enhance' && narrativeQuality.some((item) => item.category === 'emotion') ? ['emotion-enhance' as const] : []),
    ...(primary !== 'length-correction' && !input.wordCountCheck.passed ? ['length-correction' as const] : []),
  ]

  return {
    mustFix,
    narrativeQuality,
    languageQuality,
    rewriteStrategySuggestion: {
      primary,
      secondary,
      rationale: uniqueMessages([
        ...mustFix.slice(0, 3).map((item) => item.summary),
        ...narrativeQuality.slice(0, 3).map((item) => item.summary),
        ...languageQuality.slice(0, 2).map((item) => item.summary),
      ]),
    },
  }
}

function mergePressureHookIssues(
  hookPressures: Array<{ hookId: string; pressureScore: number; riskLevel: string }>,
  highPressureHookIds: string[],
  content: string,
): string[] {
  const targetHookIds = uniqueStrings([
    ...highPressureHookIds,
    ...hookPressures.filter((item) => item.riskLevel === 'high' || item.pressureScore >= 70).map((item) => item.hookId),
  ])

  return targetHookIds
    .filter((hookId) => !content.includes(hookId))
    .map((hookId) => `高压力 Hook ${hookId} 本章未得到明确推进。`)
}

function mergeArcIssues(
  characterArcs: Array<{ characterId: string; arc: string; currentStage: string }>,
  characterArcTargets: string[],
  content: string,
): string[] {
  const targetEntries = characterArcTargets.length > 0
    ? characterArcTargets
    : characterArcs.slice(0, 3).map((item) => `${item.characterId}:${item.arc}:${item.currentStage}`)

  return targetEntries
    .filter((entry) => !content.includes(entry.split(':')[0] ?? ''))
    .map((entry) => {
      const [characterId, arc, stage] = entry.split(':')
      return `角色 ${characterId} 的弧线 ${arc ?? 'current-arc'}（当前阶段=${stage ?? 'unknown'}）本章承接不足。`
    })
}

function mergeEndingReadinessIssues(
  plan: { subplotCarryThreadIds: string[]; carryOutTasks: string[]; endingDrive: string },
  content: string,
): string[] {
  return [
    ...plan.subplotCarryThreadIds
      .filter((threadId) => !content.includes(threadId))
      .map((threadId) => `终局收束准备不足：关键支线 ${threadId} 尚未在本章形成承接。`),
    ...(plan.endingDrive.trim().length > 0 && !includesAnySegment(content, [plan.endingDrive])
      ? [`终局收束准备不足：章末未体现结局前置牵引。`]
      : []),
    ...plan.carryOutTasks
      .filter((task) => task.includes('后续') && !includesAnySegment(content, [task]))
      .map((task) => `终局收束准备不足：未形成后续收束承接口。${task}`),
  ]
}

function mergeEnsembleBalanceIssues(
  ensembleFocusCharacterIds: string[],
  subplotCarryThreadIds: string[],
  content: string,
): string[] {
  return [
    ...ensembleFocusCharacterIds
      .filter((characterId) => !content.includes(characterId))
      .map((characterId) => `群像平衡不足：角色 ${characterId} 本章未得到重新承接。`),
    ...subplotCarryThreadIds
      .filter((threadId) => !content.includes(threadId))
      .map((threadId) => `支线承接不足：线程 ${threadId} 本章未得到重新挂接。`),
  ]
}

function mergeDebtCarryIssues(
  debtCarryTargets: string[],
  openNarrativeDebts: Array<{ summary: string }>,
  content: string,
): string[] {
  const targets = debtCarryTargets.length > 0
    ? debtCarryTargets
    : openNarrativeDebts.slice(0, 3).map((item) => item.summary)

  return targets
    .filter((target) => !content.includes(target.split('：').at(-1) ?? target))
    .map((target) => `未完成叙事债务未被承接：${target}`)
}

function mergeSceneExecutionIssues(
  sceneGoals: Array<{ sceneTitle: string; conflict: string; informationReveal: string; emotionalShift: string }>,
  sceneOutcomeChecklist: Array<{ sceneTitle: string; mustHappen: string[] }>,
  content: string,
): string[] {
  const issues: string[] = []

  for (const goal of sceneGoals) {
    const sceneTitleMentioned = content.includes(goal.sceneTitle)
    const conflictCovered = includesAnySegment(content, [goal.conflict])
    const revealCovered = includesAnySegment(content, [goal.informationReveal])

    if (!sceneTitleMentioned && !conflictCovered && !revealCovered) {
      issues.push(`场景任务 ${goal.sceneTitle} 在正文中落地不足。`)
    }
  }

  for (const checklist of sceneOutcomeChecklist) {
    const missedItems = checklist.mustHappen.filter((item) => !includesAnySegment(content, [item]))

    if (missedItems.length > 0) {
      issues.push(`场景 ${checklist.sceneTitle} 缺少结果兑现：${missedItems.join('；')}`)
    }
  }

  return uniqueMessages(issues)
}

function mergeEndingDriveIssues(endingDrive: string, content: string): string[] {
  if (!endingDrive.trim()) {
    return []
  }

  return includesAnySegment(content, [endingDrive])
    ? []
    : [`章节结尾牵引不足，未明显兑现计划中的结尾驱动：${endingDrive}`]
}

function mergeEmotionalProgressionIssues(
  sceneEmotionalTargets: Array<{ sceneTitle: string; startingEmotion: string; targetEmotion: string; intensity: string }>,
  content: string,
): string[] {
  return sceneEmotionalTargets
    .filter((target) => {
      const mentionedStart = includesAnySegment(content, [target.startingEmotion])
      const mentionedEnd = includesAnySegment(content, [target.targetEmotion])
      return !mentionedStart || !mentionedEnd
    })
    .map((target) => `场景 ${target.sceneTitle} 的情绪推进不足：${target.startingEmotion} -> ${target.targetEmotion} (${target.intensity})`)
}

function includesAnySegment(content: string, candidates: string[]): boolean {
  return candidates
    .flatMap((candidate) => candidate.split(/[，。；、,.;:!?（）()【】\[\]<>《》“”"'\-\/\s]+/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .some((item) => content.includes(item))
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function collectHookEvidence(
  content: string,
  hookId: string,
  hookTitle: string | undefined,
  hookDescription: string | undefined,
  payoffExpectation: string | undefined,
  planNote: string | undefined,
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

function normalizeHookStatus(value: unknown): 'open' | 'foreshadowed' | 'payoff-planned' | 'resolved' {
  return isHookStatus(value) ? value : 'open'
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

function buildOutcomeCandidate(input: {
  decision: ReviewDecision
  chapterObjective: string
  newFactCandidates: string[]
  closureSuggestions: ClosureSuggestions
  consistencyIssues: string[]
  characterIssues: string[]
  itemIssues: string[]
  memoryIssues: string[]
  hookIssues: string[]
  pacingIssues: string[]
  activeHookStates: Array<{ hookId: string; status: string }>
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>
}): ReviewReport['outcomeCandidate'] {
  const resolvedFacts = uniqueMessages([
    input.chapterObjective,
    ...input.newFactCandidates,
    ...input.closureSuggestions.memory.map((item) => item.summary),
  ])
    .slice(0, 8)
    .map((summary) => ({
      summary,
      factType: inferResolvedFactType(summary),
      source: 'review' as const,
    }))

  const observationFacts = uniqueMessages([
    ...input.memoryIssues.map((item) => `待观察：${item}`),
    ...input.closureSuggestions.memory
      .filter((item) => item.memoryScope === 'observation')
      .map((item) => item.summary),
  ])
    .slice(0, 6)
    .map((summary) => ({
      summary,
      reason: 'review 判断该事实仍需后续章节继续观察',
      source: 'review' as const,
    }))

  const contradictions = uniqueMessages([
    ...input.consistencyIssues,
    ...input.characterIssues,
    ...input.itemIssues,
    ...input.hookIssues,
  ])
    .slice(0, 8)
    .map((summary) => ({
      contradictionType: inferContradictionType(summary),
      summary,
      severity: inferSeverity(summary),
      status: 'open' as const,
      sourceReviewId: undefined,
      sourceRewriteId: undefined,
    }))

  const narrativeDebts = uniqueMessages([
    ...input.pacingIssues.map((item) => `节奏债务：${item}`),
    ...input.hookIssues.map((item) => `Hook 债务：${item}`),
    ...input.closureSuggestions.hooks.map((item) => `需要继续处理 Hook ${item.hookId}：${item.actualOutcome}`),
  ])
    .slice(0, 8)
    .map((summary) => ({
      debtType: inferDebtType(summary),
      summary,
      priority: inferPriority(summary),
      status: 'open' as const,
      sourceReviewId: undefined,
      sourceRewriteId: undefined,
    }))

  const characterArcProgress = input.characterStates
    .slice(0, 6)
    .map((state) => ({
      characterId: state.characterId,
      arc: 'current-arc',
      stage: input.characterIssues.some((item) => item.includes(state.characterId)) ? 'blocked' : 'advanced',
      summary: state.statusNotes[0] ?? `角色 ${state.characterId} 在本章继续推进`,
    }))

  const hookDebtUpdates = uniqueHookIds([
    ...input.activeHookStates.map((item) => item.hookId),
    ...input.closureSuggestions.hooks.map((item) => item.hookId),
  ])
    .slice(0, 8)
    .map((hookId) => ({
      hookId,
      pressure: input.hookIssues.some((item) => item.includes(hookId)) ? 'high' as const : 'medium' as const,
      summary: `Hook ${hookId} 仍需后续章节继续承接`,
    }))

  return {
    decision: input.decision,
    resolvedFacts,
    observationFacts,
    contradictions,
    narrativeDebts,
    characterArcProgress,
    hookDebtUpdates,
  }
}

function inferResolvedFactType(summary: string): 'character' | 'item' | 'hook' | 'world' | 'plot' | 'memory' {
  if (summary.includes('角色')) {
    return 'character'
  }

  if (summary.includes('物品')) {
    return 'item'
  }

  if (summary.includes('Hook') || summary.includes('伏笔')) {
    return 'hook'
  }

  if (summary.includes('记忆')) {
    return 'memory'
  }

  if (summary.includes('世界') || summary.includes('地点')) {
    return 'world'
  }

  return 'plot'
}

function inferContradictionType(summary: string): 'world' | 'character' | 'plot' | 'fact' | 'hook' {
  if (summary.includes('角色')) {
    return 'character'
  }

  if (summary.includes('Hook') || summary.includes('伏笔')) {
    return 'hook'
  }

  if (summary.includes('世界') || summary.includes('地点')) {
    return 'world'
  }

  if (summary.includes('事实') || summary.includes('一致')) {
    return 'fact'
  }

  return 'plot'
}

function inferDebtType(summary: string): 'hook' | 'promise' | 'conflict' | 'emotion' | 'arc' | 'fact' {
  if (summary.includes('Hook') || summary.includes('伏笔')) {
    return 'hook'
  }

  if (summary.includes('情绪')) {
    return 'emotion'
  }

  if (summary.includes('角色')) {
    return 'arc'
  }

  if (summary.includes('冲突')) {
    return 'conflict'
  }

  if (summary.includes('事实')) {
    return 'fact'
  }

  return 'promise'
}

function inferSeverity(summary: string): 'low' | 'medium' | 'high' {
  if (summary.includes('冲突') || summary.includes('矛盾') || summary.includes('违背')) {
    return 'high'
  }

  return 'medium'
}

function inferPriority(summary: string): 'low' | 'medium' | 'high' {
  if (summary.includes('Hook') || summary.includes('冲突') || summary.includes('结尾')) {
    return 'high'
  }

  return 'medium'
}

function uniqueHookIds(values: string[]): string[] {
  return [...new Set(values.filter((item) => item.trim().length > 0))]
}

function uniqueMessages(messages: string[]): string[] {
  return [...new Set(messages)]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
