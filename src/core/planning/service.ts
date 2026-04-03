import type { ChapterPlan, Hook, HookPlan, LlmAdapter, PlanningContext, SceneCard } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { extractJsonObject } from '../../shared/utils/json.js'
import { nowIso } from '../../shared/utils/time.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { PlanningContextBuilder } from '../context/planning-context-builder.js'

type ActiveHookView = {
  hookId: string
  title: string
  description: string
  payoffExpectation: string
  priority: Hook['priority']
  status: Hook['status']
}

export class PlanningService {
  constructor(
    private readonly contextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly llmAdapter: LlmAdapter | null,
    private readonly hookRepository: HookRepository,
  ) {}

  async planChapter(chapterId: string): Promise<ChapterPlan> {
    const context = this.contextBuilder.build(chapterId)
    const activeHooks = buildActiveHookViews(context, this.hookRepository.listByBookId(context.book.id))
    const plan = this.llmAdapter
      ? await createLlmPlan(this.llmAdapter, context, activeHooks)
      : createRuleBasedPlan(context, activeHooks)

    this.chapterPlanRepository.create(plan)
    this.chapterRepository.updateCurrentPlanVersion(chapterId, plan.versionId, plan.createdAt)

    return plan
  }
}

async function createLlmPlan(
  llmAdapter: LlmAdapter,
  context: PlanningContext,
  activeHooks: ActiveHookView[],
): Promise<ChapterPlan> {
  const fallbackPlan = createRuleBasedPlan(context, activeHooks)
  const response = await llmAdapter.generateText({
    system: [
      '你是长篇小说章节规划助手，不负责写正文，只负责制定可执行的章节计划。',
      '你的目标不是平均分配信息，而是让本章形成清晰的冲突递进、场景推进和结尾牵引。',
      '必须优先满足以下约束：承接上一章局势、呼应本章目标、推进至少一条核心冲突、避免违背角色/物品/Hook/记忆真源。',
      'sceneCards 必须像真正的场景设计，而不是空泛标题；每个场景都应有 purpose、beats、人物与关键道具指向。',
      'eventOutline 必须描述本章实际会发生的关键事件，不要写抽象口号。',
      'statePredictions 必须具体到本章后哪些角色状态、物品状态、Hook 状态、记忆沉淀会发生变化。',
      'memoryCandidates 必须是未来值得沉淀的稳定事实或高价值事件，不要重复空话。',
      '只输出 JSON，不要解释，不要使用 markdown 代码块。',
      'JSON 至少包含 objective, sceneCards, requiredCharacterIds, requiredLocationIds, requiredItemIds, eventOutline, hookPlan, statePredictions, memoryCandidates。',
    ].join(' '),
    user: JSON.stringify(buildPlanningPromptPayload(context, activeHooks), null, 2),
  })

  const parsed = JSON.parse(extractJsonObject(response.text)) as Partial<ChapterPlan>
  const normalizedSceneCards = normalizeSceneCards(parsed.sceneCards, fallbackPlan.sceneCards)
  const normalizedRequiredCharacterIds = normalizeStringArray(parsed.requiredCharacterIds, fallbackPlan.requiredCharacterIds)
  const normalizedRequiredLocationIds = normalizeStringArray(parsed.requiredLocationIds, fallbackPlan.requiredLocationIds)
  const normalizedRequiredFactionIds = normalizeStringArray(parsed.requiredFactionIds, fallbackPlan.requiredFactionIds)
  const normalizedRequiredItemIds = normalizeStringArray(parsed.requiredItemIds, fallbackPlan.requiredItemIds)
  const normalizedEventOutline = normalizeStringArray(parsed.eventOutline, fallbackPlan.eventOutline)
  const normalizedHookPlan = normalizeHookPlan(parsed.hookPlan, fallbackPlan.hookPlan)
  const normalizedStatePredictions = normalizeStatePredictions(parsed.statePredictions, fallbackPlan.statePredictions)
  const normalizedMemoryCandidates = normalizeMemoryCandidates(parsed.memoryCandidates, fallbackPlan.memoryCandidates)

  return {
    ...fallbackPlan,
    objective: parsed.objective ?? fallbackPlan.objective,
    sceneCards: normalizedSceneCards,
    requiredCharacterIds: normalizedRequiredCharacterIds,
    requiredLocationIds: normalizedRequiredLocationIds,
    requiredFactionIds: normalizedRequiredFactionIds,
    requiredItemIds: normalizedRequiredItemIds,
    eventOutline: normalizedEventOutline,
    hookPlan: normalizedHookPlan,
    statePredictions: normalizedStatePredictions,
    memoryCandidates: normalizedMemoryCandidates,
  }
}

function buildPlanningPromptPayload(context: PlanningContext, activeHooks: ActiveHookView[]): Record<string, unknown> {
  return {
    task: {
      kind: 'chapter-planning',
      deliverable: '为当前章节生成结构化计划 JSON',
      mustDo: [
        '承接上一章局势',
        '呼应章节目标',
        '推进至少一条核心冲突',
        '至少推进或处理一条活跃 Hook（若存在）',
        '给出明确的章节结尾牵引',
      ],
      avoid: [
        '空泛场景标题',
        '只有设定说明没有事件推进',
        '忽略角色当前位置与当前状态',
        '忽略关键物品连续性',
        '忽略长期记忆约束',
      ],
    },
    bookContext: {
      bookTitle: context.book.title,
      chapterTitle: context.chapter.title,
      chapterObjective: context.chapter.objective,
      plannedBeats: context.chapter.plannedBeats,
      volumeTitle: context.volume.title,
      volumeGoal: context.volume.goal,
      volumeSummary: context.volume.summary,
      theme: context.outline.theme,
      premise: context.outline.premise,
      worldview: context.outline.worldview,
      coreConflicts: context.outline.coreConflicts,
      endingVision: context.outline.endingVision,
      previousChapterSummary: context.previousChapter?.summary,
    },
    stateConstraints: {
      characterStates: context.characterStates.map((state) => ({
        characterId: state.characterId,
        currentLocationId: state.currentLocationId,
        statusNotes: state.statusNotes,
      })),
      importantItems: context.importantItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        status: item.status,
        ownerCharacterId: item.ownerCharacterId,
        locationId: item.locationId,
      })),
      activeHooks,
      memoryRecall: context.memoryRecall,
    },
    outputRules: {
      sceneCardGuideline: '建议 2-4 个场景，必须包含开场承接、核心推进、结尾牵引中的至少两类功能',
      eventOutlineGuideline: '使用可执行事件，不要写抽象评价',
      statePredictionGuideline: '尽量具体写出哪些状态将在章末变化',
      hookPlanGuideline: '如果存在活跃 Hook，应给出动作和简短说明',
    },
  }
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)

  return normalized.length > 0 ? normalized : fallback
}

function normalizeSceneCards(value: unknown, fallback: ChapterPlan['sceneCards']): ChapterPlan['sceneCards'] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized: SceneCard[] = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const title = typeof candidate.title === 'string' && candidate.title.trim().length > 0
        ? candidate.title.trim()
        : `场景 ${index + 1}`
      const purpose = typeof candidate.purpose === 'string' && candidate.purpose.trim().length > 0
        ? candidate.purpose.trim()
        : '推进章节目标与冲突'
      const beats = Array.isArray(candidate.beats)
        ? candidate.beats.filter((beat): beat is string => typeof beat === 'string' && beat.trim().length > 0)
        : []
      const characterIds = normalizeStringArray(candidate.characterIds ?? candidate.characters, [])
      const factionIds = normalizeStringArray(candidate.factionIds ?? candidate.factions, [])
      const itemIds = normalizeStringArray(candidate.itemIds ?? candidate.items, [])
      const locationId = typeof candidate.locationId === 'string'
        ? candidate.locationId
        : (typeof candidate.location === 'string' ? candidate.location : undefined)

      const sceneCard: SceneCard = {
        title,
        purpose,
        beats: beats.length > 0 ? beats : ['推进当前场景目标'],
        characterIds,
        factionIds,
        itemIds,
      }

      if (locationId) {
        sceneCard.locationId = locationId
      }

      return sceneCard
    })
    .filter((item): item is SceneCard => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function normalizeHookPlan(value: unknown, fallback: ChapterPlan['hookPlan']): ChapterPlan['hookPlan'] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const hookId = typeof candidate.hookId === 'string' ? candidate.hookId.trim() : ''
      const action = normalizeHookAction(candidate.action)
      const note = typeof candidate.note === 'string' && candidate.note.trim().length > 0
        ? candidate.note.trim()
        : '承接并推进该 Hook。'

      if (!hookId) {
        return null
      }

      return {
        hookId,
        action,
        note,
      }
    })
    .filter((item): item is ChapterPlan['hookPlan'][number] => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function normalizeHookAction(value: unknown): HookPlan['action'] {
  return value === 'hold' || value === 'foreshadow' || value === 'advance' || value === 'payoff'
    ? value
    : 'advance'
}

function normalizeStatePredictions(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }

        if (item && typeof item === 'object') {
          const candidate = item as Record<string, unknown>
          const entityId = typeof candidate.characterId === 'string'
            ? candidate.characterId
            : (typeof candidate.itemId === 'string'
                ? candidate.itemId
                : (typeof candidate.hookId === 'string' ? candidate.hookId : ''))
          const change = typeof candidate.change === 'string' ? candidate.change.trim() : ''
          return [entityId, change].filter((part) => part.length > 0).join('：')
        }

        return ''
      })
      .filter((item) => item.length > 0)

    return normalized.length > 0 ? normalized : fallback
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    const flattened = Object.entries(candidate)
      .flatMap(([, section]) => Array.isArray(section) ? section : [])
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return ''
        }

        const entry = item as Record<string, unknown>
        const entityId = typeof entry.characterId === 'string'
          ? entry.characterId
          : (typeof entry.itemId === 'string'
              ? entry.itemId
              : (typeof entry.hookId === 'string' ? entry.hookId : ''))
        const change = typeof entry.change === 'string' ? entry.change.trim() : ''
        return [entityId, change].filter((part) => part.length > 0).join('：')
      })
      .filter((item) => item.length > 0)

    return flattened.length > 0 ? flattened : fallback
  }

  return fallback
}

function normalizeMemoryCandidates(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }

      if (item && typeof item === 'object') {
        const candidate = item as Record<string, unknown>
        return typeof candidate.content === 'string' ? candidate.content.trim() : ''
      }

      return ''
    })
    .filter((item) => item.length > 0)

  return normalized.length > 0 ? normalized : fallback
}

function createRuleBasedPlan(context: PlanningContext, activeHooks: ActiveHookView[]): ChapterPlan {
  const timestamp = nowIso()
  const previousChapterSummary = context.previousChapter
    ? `承接上一章《${context.previousChapter.title}》的推进结果。`
    : '作为开篇章节建立世界与主角当前局势。'
  const requiredCharacterIds = context.characterStates.slice(0, 3).map((state) => state.characterId)
  const requiredLocationIds = uniqueStrings(
    context.characterStates
      .filter((state) => requiredCharacterIds.includes(state.characterId))
      .map((state) => state.currentLocationId)
      .filter((locationId): locationId is string => Boolean(locationId)),
  )
  const requiredItemIds = context.importantItems.slice(0, 2).map((item) => item.id)
  const importantItemBeat = context.importantItems[0]
    ? `确保关键物品 ${context.importantItems[0].name} 在本章保持状态连续。`
    : undefined
  const memoryBeat = context.memoryRecall.recentEvents[0]
    ? `承接最近事件：${context.memoryRecall.recentEvents[0]}`
    : undefined
  const hookPlan = activeHooks.slice(0, 3).map((hook) => ({
    hookId: hook.hookId,
    action: suggestHookAction(hook.status),
    note: `围绕 Hook《${hook.title}》进行${describeHookAction(suggestHookAction(hook.status))}，避免本章脱离当前伏笔。`,
  }))
  const characterStateBeat = context.characterStates[0]
    ? `承接关键角色 ${context.characterStates[0].characterId} 的当前位置与状态。`
    : undefined
  const hookBeat = hookPlan[0]
    ? `处理活跃 Hook：${hookPlan[0].hookId}，执行 ${hookPlan[0].action}`
    : undefined

  return {
    id: createId('plan'),
    bookId: context.book.id,
    chapterId: context.chapter.id,
    versionId: createId('plan_version'),
    objective: context.chapter.objective,
    sceneCards: [
      {
        title: `${context.chapter.title}-开场铺垫`,
        purpose: '建立本章目标、冲突背景与主要人物处境',
        beats: [
          previousChapterSummary,
          ...(memoryBeat ? [memoryBeat] : []),
          ...(characterStateBeat ? [characterStateBeat] : []),
          `点明本章目标：${context.chapter.objective}`,
          `引入卷目标压力：${context.volume.goal}`,
        ],
        characterIds: requiredCharacterIds.slice(0, 2),
        locationId: requiredLocationIds[0],
        factionIds: [],
        itemIds: requiredItemIds,
      },
      {
        title: `${context.chapter.title}-核心推进`,
        purpose: '推进本章核心事件并形成章节结尾钩子',
        beats: context.chapter.plannedBeats.length > 0
          ? context.chapter.plannedBeats
          : [
              '推进当前核心冲突',
              '形成新的局势变化',
              '在结尾制造下一章牵引力',
            ],
        characterIds: requiredCharacterIds,
        locationId: requiredLocationIds[0],
        factionIds: [],
        itemIds: requiredItemIds,
      },
    ],
    requiredCharacterIds,
    requiredLocationIds,
    requiredFactionIds: [],
    requiredItemIds,
    eventOutline: [
      `围绕章节目标推进：${context.chapter.objective}`,
      `呼应卷目标：${context.volume.goal}`,
      `至少推进一条核心冲突：${context.outline.coreConflicts[0]}`,
      ...(importantItemBeat ? [importantItemBeat] : []),
      ...(hookBeat ? [hookBeat] : []),
    ],
    hookPlan,
    statePredictions: [
      '更新当前章节推进位置',
      '记录本章形成的关键事件',
      ...(requiredCharacterIds.length > 0 ? ['关键角色状态应在本章后产生可追踪变化'] : []),
      ...(hookPlan.length > 0 ? ['至少一条活跃 Hook 的状态应在本章后发生推进'] : []),
      ...(context.memoryRecall.relevantLongTermEntries.length > 0 ? ['避免与高重要长期记忆冲突'] : []),
    ],
    memoryCandidates: [
      `${context.chapter.title} 的关键事件摘要`,
      `${context.chapter.objective} 对主线造成的推进结果`,
      ...hookPlan.slice(0, 2).map((item) => `Hook ${item.hookId} 在本章的推进结果`),
      ...context.memoryRecall.relevantLongTermEntries.slice(0, 2).map((entry) => `承接长期记忆：${entry.summary}`),
    ],
    createdAt: timestamp,
    approvedByUser: false,
  }
}

function buildActiveHookViews(context: PlanningContext, hooks: Hook[]): ActiveHookView[] {
  const hookById = new Map(hooks.map((hook) => [hook.id, hook]))

  return context.activeHookStates.map((state) => {
    const hook = hookById.get(state.hookId)

    return {
      hookId: state.hookId,
      title: hook?.title ?? state.hookId,
      description: hook?.description ?? '',
      payoffExpectation: hook?.payoffExpectation ?? '',
      priority: hook?.priority ?? 'medium',
      status: state.status,
    }
  })
}

function suggestHookAction(status: Hook['status']): HookPlan['action'] {
  if (status === 'open') {
    return 'foreshadow'
  }

  if (status === 'foreshadowed') {
    return 'advance'
  }

  if (status === 'payoff-planned') {
    return 'payoff'
  }

  return 'hold'
}

function describeHookAction(action: HookPlan['action']): string {
  if (action === 'foreshadow') {
    return '轻量铺垫'
  }

  if (action === 'advance') {
    return '实质推进'
  }

  if (action === 'payoff') {
    return '回收兑现'
  }

  return '状态承接'
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}
