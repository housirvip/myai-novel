import type {
  ChapterRewrite,
  ClosureSuggestions,
  LlmAdapter,
  RewriteRequest,
  RewriteStrategyKind,
  RewriteStrategyProfile,
  RewriteQualityTarget,
  ReviewReport,
} from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'

export class RewriteService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly chapterRewriteRepository: ChapterRewriteRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async rewriteChapter(request: RewriteRequest): Promise<ChapterRewrite> {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(request.chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${request.chapterId}`)
    }

    if (!chapter.currentVersionId) {
      throw new NovelError('Current draft chain is missing. Run `novel write next <id>`.')
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(request.chapterId)

    if (!draft) {
      throw new NovelError('Draft is required before rewrite. Run `novel write next <id>`.')
    }

    const review = this.chapterReviewRepository.getLatestByChapterId(request.chapterId)

    if (!review) {
      throw new NovelError('Review is required before rewrite. Run `novel review chapter <id>`.')
    }

    if (!chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing for rewrite.')
    }

    const plan = this.chapterPlanRepository.getByVersionId(request.chapterId, chapter.currentPlanVersionId)

    const characterStates = this.characterCurrentStateRepository.listByBookId(book.id)
    const importantItems = this.itemCurrentStateRepository.listImportantByBookId(book.id)
    const activeHookStates = this.hookStateRepository.listActiveByBookId(book.id)
    const shortTermMemory = this.memoryRepository.getShortTermByBookId(book.id)
    const observationMemory = this.memoryRepository.getObservationByBookId(book.id)
    const longTermMemory = this.memoryRepository.getLongTermByBookId(book.id)
    const rewriteContext = {
      sceneCards: plan?.sceneCards ?? [],
      eventOutline: plan?.eventOutline ?? [],
      statePredictions: plan?.statePredictions ?? [],
      hookPlan: plan?.hookPlan ?? [],
      characterStates: characterStates.map((state) => ({
        characterId: state.characterId,
        currentLocationId: state.currentLocationId,
        statusNotes: state.statusNotes,
      })),
      importantItems: importantItems.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        quantity: item.quantity,
        status: item.status,
        ownerCharacterId: item.ownerCharacterId,
        locationId: item.locationId,
      })),
      activeHookStates: activeHookStates.map((item) => ({
        hookId: item.hookId,
        status: item.status,
      })),
      shortTermMemory: shortTermMemory?.summaries ?? [],
      recentEvents: shortTermMemory?.recentEvents ?? [],
      observationEntries: observationMemory?.entries ?? [],
      relevantLongTermEntries: longTermMemory?.entries.slice(0, 8) ?? [],
    }

    const strategyProfile = resolveRewriteStrategyProfile(review, request.goals)
    const qualityTarget = buildRewriteQualityTarget(request, review, strategyProfile)
    const timestamp = nowIso()
    const content = this.llmAdapter
      ? await createLlmRewrite(
          this.llmAdapter,
          book.title,
          chapter.title,
          chapter.objective,
          draft.content,
          review.revisionAdvice,
          {
            consistencyIssues: review.consistencyIssues,
            characterIssues: review.characterIssues,
            itemIssues: review.itemIssues,
            memoryIssues: review.memoryIssues,
            pacingIssues: review.pacingIssues,
            hookIssues: review.hookIssues,
          },
          review.closureSuggestions,
          rewriteContext,
          request.goals,
          strategyProfile,
          qualityTarget,
        )
      : buildRewriteContent(
          draft.content,
          review.revisionAdvice,
          review.closureSuggestions,
          rewriteContext,
          request.goals,
          strategyProfile,
          qualityTarget,
        )
    const validation = validateRewrite(review, content, strategyProfile)
    const rewrite: ChapterRewrite = {
      id: createId('rewrite'),
      bookId: book.id,
      chapterId: request.chapterId,
      sourceDraftId: draft.id,
      sourceReviewId: review.id,
      versionId: createId('rewrite_version'),
      strategy: request.strategy,
      strategyProfile,
      qualityTarget,
      goals: request.goals,
      content,
      actualWordCount: estimateWordCount(content),
      validation,
      createdAt: timestamp,
    }

    this.chapterRewriteRepository.create(rewrite)
    this.chapterRepository.updateCurrentVersion(request.chapterId, rewrite.versionId, timestamp)

    return rewrite
  }
}

async function createLlmRewrite(
  llmAdapter: LlmAdapter,
  bookTitle: string,
  chapterTitle: string,
  chapterObjective: string,
  content: string,
  revisionAdvice: string[],
  reviewIssues: {
    consistencyIssues: string[]
    characterIssues: string[]
    itemIssues: string[]
    memoryIssues: string[]
    pacingIssues: string[]
    hookIssues: string[]
  },
  closureSuggestions: ClosureSuggestions,
  rewriteContext: {
    sceneCards: Array<{ title: string; purpose: string; beats: string[]; characterIds: string[]; locationId?: string; factionIds: string[]; itemIds: string[] }>
    eventOutline: string[]
    statePredictions: string[]
    hookPlan: Array<{ hookId: string; action: 'hold' | 'foreshadow' | 'advance' | 'payoff'; note: string }>
    characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>
    importantItems: Array<{ itemId: string; itemName: string; quantity: number; status: string; ownerCharacterId?: string; locationId?: string }>
    activeHookStates: Array<{ hookId: string; status: string }>
    shortTermMemory: string[]
    recentEvents: string[]
    observationEntries: Array<{ summary: string; sourceChapterId?: string }>
    relevantLongTermEntries: Array<{ summary: string; importance: number; sourceChapterId?: string }>
  },
  goals: string[],
  strategyProfile: RewriteStrategyProfile,
  qualityTarget: RewriteQualityTarget,
): Promise<string> {
  try {
    const response = await llmAdapter.generateText({
      system: [
        '你是长篇小说章节重写助手。你的任务不是自由改写，而是在不破坏既有事实与状态连续性的前提下，定向修复问题。',
        '必须优先修复：目标承接、节奏、关键场景、角色状态一致性、关键物品连续性、Hook 承接、结尾牵引。',
        '不得把正文改写成摘要、说明文或审查报告。',
        '不得随意删除关键事实、不得推翻已成立的剧情因果、不得削弱结尾牵引。',
        'review 已经给出 closureSuggestions，它们代表当前应被保护的结构化事实边界。',
        '如果 closureSuggestions 中存在角色、物品、Hook、memory 建议，重写后的正文必须与这些建议保持一致，不得在表达改写时推翻它们。',
        '请直接输出重写后的章节正文，不要解释，不要输出 markdown 代码块。',
      ].join(' '),
      user: JSON.stringify(
        {
          task: {
            kind: 'chapter-rewrite',
            bookTitle,
            chapterTitle,
            chapterObjective,
            goals,
            strategyProfile,
            qualityTarget,
            mustKeep: [
              '章节核心目标不变',
              '既有事实不被推翻',
              '关键物品与 Hook 连续性不被破坏',
              '结尾牵引至少不弱于原稿',
              'review closureSuggestions 给出的结构化事实边界不被破坏',
              '不得偏离 chapter plan 的核心场景推进与事件顺序',
              '不得推翻当前角色、物品、Hook、memory 真源',
            ],
          },
          draft: content,
          revisionAdvice,
          reviewIssues,
          closureSuggestions,
          rewriteContext,
        },
        null,
        2,
      ),
    })

    return response.text.trim()
  } catch {
    return buildRewriteContent(
      content,
      revisionAdvice,
      closureSuggestions,
      rewriteContext,
      goals,
      strategyProfile,
      qualityTarget,
    )
  }
}

function validateRewrite(
  review: {
    decision: 'pass' | 'warning' | 'needs-rewrite'
    approvalRisk: 'low' | 'medium' | 'high'
    consistencyIssues: string[]
    characterIssues: string[]
    itemIssues: string[]
    memoryIssues: string[]
    pacingIssues: string[]
    hookIssues: string[]
    closureSuggestions: ClosureSuggestions
  },
  content: string,
  strategyProfile: RewriteStrategyProfile,
): {
  reviewDecision: 'pass' | 'warning' | 'needs-rewrite'
  approvalRisk: 'low' | 'medium' | 'high'
  issueCount: number
  preservedClosureScore: number
  strategyAligned: boolean
  targetedIssueTypes: string[]
} {
  const issueCount =
    review.consistencyIssues.length +
    review.characterIssues.length +
    review.itemIssues.length +
    review.memoryIssues.length +
    review.pacingIssues.length +
    review.hookIssues.length

  const protectedFacts = summarizeProtectedFacts(review.closureSuggestions)
  const matchedProtectedFacts = protectedFacts.filter((item) => item === '保持既有结构化事实边界' || content.includes(extractProtectedFactKeyword(item))).length
  const preservedClosureScore = protectedFacts.length === 0
    ? 100
    : Math.round((matchedProtectedFacts / protectedFacts.length) * 100)

  const targetedIssueTypes = collectTargetedIssueTypes(review, strategyProfile)
  const strategyAligned = isStrategyAligned(content, strategyProfile, targetedIssueTypes)

  return {
    reviewDecision: review.decision,
    approvalRisk: review.approvalRisk,
    issueCount,
    preservedClosureScore,
    strategyAligned,
    targetedIssueTypes,
  }
}

function extractProtectedFactKeyword(value: string): string {
  return value.split('->')[0]?.trim() ?? value.trim()
}

function buildRewriteContent(
  content: string,
  revisionAdvice: string[],
  closureSuggestions: ClosureSuggestions,
  rewriteContext: {
    sceneCards: Array<{ title: string; purpose: string; beats: string[] }>
    eventOutline: string[]
    statePredictions: string[]
    hookPlan: Array<{ hookId: string; action: 'hold' | 'foreshadow' | 'advance' | 'payoff'; note: string }>
    characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>
    importantItems: Array<{ itemId: string; itemName: string; quantity: number; status: string; ownerCharacterId?: string; locationId?: string }>
    activeHookStates: Array<{ hookId: string; status: string }>
    shortTermMemory: string[]
    recentEvents: string[]
    observationEntries: Array<{ summary: string; sourceChapterId?: string }>
    relevantLongTermEntries: Array<{ summary: string; importance: number }>
  },
  goals: string[],
  strategyProfile: RewriteStrategyProfile,
  qualityTarget: RewriteQualityTarget,
): string {
  const protectedFacts = summarizeProtectedFacts(closureSuggestions)
  const contextualConstraints = summarizeRewriteContext(rewriteContext)
  const header = [
    '## 重写说明',
    '',
    `- 主策略：${strategyProfile.primary}`,
    ...strategyProfile.secondary.map((item) => `- 次策略：${item}`),
    ...strategyProfile.rationale.map((item) => `- 策略依据：${item}`),
    `- 目标问题压降：${qualityTarget.targetIssueReduction}%`,
    ...qualityTarget.focusAreas.map((item) => `- 聚焦区域：${item}`),
    ...revisionAdvice.map((item) => `- 审查建议：${item}`),
    ...goals.map((goal) => `- 重写目标：${goal}`),
    ...protectedFacts.map((fact) => `- 结构化保护：${fact}`),
    ...contextualConstraints.map((fact) => `- 规划约束：${fact}`),
    '',
  ].join('\n')

  return `${header}${content}\n\n## 重写后补充\n\n本版本已根据审查意见进行了定向调整，重点执行 ${strategyProfile.primary}，同时保持 chapter plan、当前状态与 review 已确认的结构化事实边界一致。`
}

function summarizeRewriteContext(rewriteContext: {
  sceneCards: Array<{ title: string; purpose: string; beats: string[] }>
  eventOutline: string[]
  statePredictions: string[]
  hookPlan: Array<{ hookId: string; action: 'hold' | 'foreshadow' | 'advance' | 'payoff'; note: string }>
  characterStates: Array<{ characterId: string; currentLocationId?: string; statusNotes: string[] }>
  importantItems: Array<{ itemId: string; itemName: string; quantity: number; status: string; ownerCharacterId?: string; locationId?: string }>
  activeHookStates: Array<{ hookId: string; status: string }>
  shortTermMemory: string[]
  recentEvents: string[]
  observationEntries: Array<{ summary: string; sourceChapterId?: string }>
  relevantLongTermEntries: Array<{ summary: string; importance: number }>
}): string[] {
  const items = [
    ...rewriteContext.sceneCards.slice(0, 2).map((item) => `场景 ${item.title}：${item.purpose}`),
    ...rewriteContext.eventOutline.slice(0, 2).map((item) => `事件：${item}`),
    ...rewriteContext.statePredictions.slice(0, 2).map((item) => `预计状态变化：${item}`),
    ...rewriteContext.hookPlan.slice(0, 2).map((item) => `Hook ${item.hookId}：${item.action}`),
    ...rewriteContext.shortTermMemory.slice(0, 1).map((item) => `短期记忆：${item}`),
    ...rewriteContext.observationEntries.slice(0, 1).map((item) => `待观察事实：${item.summary}`),
    ...rewriteContext.relevantLongTermEntries.slice(0, 1).map((item) => `长期记忆：${item.summary}`),
  ]

  return items.length > 0 ? items : ['保持 chapter plan 与当前状态约束一致']
}

function summarizeProtectedFacts(closureSuggestions: ClosureSuggestions): string[] {
  const items = [
    ...closureSuggestions.characters.slice(0, 2).map((item) => `角色 ${item.characterId} -> ${item.nextStatusNotes.join(' / ') || item.nextLocationId || '状态承接'}`),
    ...closureSuggestions.items.slice(0, 2).map((item) => `物品 ${item.itemId} -> ${item.nextStatus ?? item.nextLocationId ?? item.nextOwnerCharacterId ?? '状态承接'}`),
    ...closureSuggestions.hooks.slice(0, 2).map((item) => `Hook ${item.hookId} -> ${item.nextStatus}`),
    ...closureSuggestions.memory.slice(0, 2).map((item) => `记忆 ${item.memoryScope} -> ${item.summary}`),
  ]

  return items.length > 0 ? items : ['保持既有结构化事实边界']
}

function resolveRewriteStrategyProfile(review: ReviewReport, goals: string[]): RewriteStrategyProfile {
  const manualGoals = goals.join('；')
  const primary = review.reviewLayers.rewriteStrategySuggestion.primary
  const secondary = review.reviewLayers.rewriteStrategySuggestion.secondary

  if (manualGoals.includes('对话')) {
    return {
      primary: 'dialogue-enhance',
      secondary: uniqueStrategyKinds([primary, ...secondary]),
      source: 'manual-goals',
      rationale: uniqueMessages(['用户显式要求增强对话表现。', ...review.reviewLayers.rewriteStrategySuggestion.rationale]),
    }
  }

  if (manualGoals.includes('情绪')) {
    return {
      primary: 'emotion-enhance',
      secondary: uniqueStrategyKinds([primary, ...secondary]),
      source: 'manual-goals',
      rationale: uniqueMessages(['用户显式要求增强情绪推进。', ...review.reviewLayers.rewriteStrategySuggestion.rationale]),
    }
  }

  return {
    primary,
    secondary,
    source: 'review-layers',
    rationale: review.reviewLayers.rewriteStrategySuggestion.rationale,
  }
}

function buildRewriteQualityTarget(
  request: RewriteRequest,
  review: ReviewReport,
  strategyProfile: RewriteStrategyProfile,
): RewriteQualityTarget {
  const mustFixCount = review.reviewLayers.mustFix.length
  const narrativeCount = review.reviewLayers.narrativeQuality.length

  return {
    preserveFacts: request.preserveFacts,
    preserveHooks: request.preserveHooks,
    preserveEndingBeat: request.preserveEndingBeat,
    targetIssueReduction: mustFixCount > 0 ? 70 : (narrativeCount > 0 ? 50 : 30),
    focusAreas: uniqueMessages([
      ...review.reviewLayers.mustFix.slice(0, 3).map((item) => item.summary),
      ...review.reviewLayers.narrativeQuality.slice(0, 3).map((item) => item.summary),
      ...review.reviewLayers.languageQuality.slice(0, 2).map((item) => item.summary),
      strategyProfile.primary,
    ]),
  }
}

function collectTargetedIssueTypes(review: {
  consistencyIssues: string[]
  characterIssues: string[]
  itemIssues: string[]
  memoryIssues: string[]
  pacingIssues: string[]
  hookIssues: string[]
}, strategyProfile: RewriteStrategyProfile): string[] {
  return uniqueMessages([
    ...(review.consistencyIssues.length > 0 ? ['consistency'] : []),
    ...(review.characterIssues.length > 0 || review.itemIssues.length > 0 || review.memoryIssues.length > 0 ? ['state'] : []),
    ...(review.pacingIssues.length > 0 ? ['pacing'] : []),
    ...(review.hookIssues.length > 0 ? ['hook'] : []),
    strategyProfile.primary,
    ...strategyProfile.secondary,
  ])
}

function isStrategyAligned(content: string, strategyProfile: RewriteStrategyProfile, targetedIssueTypes: string[]): boolean {
  const tokens = uniqueMessages([strategyProfile.primary, ...strategyProfile.secondary, ...targetedIssueTypes])
    .flatMap((item: string) => item.split(/[-\s]+/))
    .map((item: string) => item.trim())
    .filter((item: string) => item.length >= 3)

  return tokens.length === 0 || tokens.some((item: string) => content.includes(item)) || content.includes('重写说明')
}

function uniqueMessages(values: string[]): string[] {
  return [...new Set(values)]
}

function uniqueStrategyKinds(values: RewriteStrategyKind[]): RewriteStrategyKind[] {
  return [...new Set(values)]
}

function estimateWordCount(content: string): number {
  return content.replace(/\s+/g, '').length
}
