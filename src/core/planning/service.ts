import type { ChapterPlan, Hook, HookPlan, LlmAdapter, PlanningContext } from '../../shared/types/domain.js'
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
    system:
      '你是小说章节规划助手。请只输出 JSON，不要解释。字段至少包含 objective, sceneCards, eventOutline, statePredictions, memoryCandidates。',
    user: JSON.stringify(
      {
        bookTitle: context.book.title,
        chapterTitle: context.chapter.title,
        chapterObjective: context.chapter.objective,
        plannedBeats: context.chapter.plannedBeats,
        volumeGoal: context.volume.goal,
        theme: context.outline.theme,
        coreConflicts: context.outline.coreConflicts,
        previousChapterTitle: context.previousChapter?.title,
        characterStates: context.characterStates.map((state) => ({
          characterId: state.characterId,
          currentLocationId: state.currentLocationId,
          statusNotes: state.statusNotes,
        })),
        activeHooks,
        memoryRecall: context.memoryRecall,
        importantItems: context.importantItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          status: item.status,
          ownerCharacterId: item.ownerCharacterId,
          locationId: item.locationId,
        })),
      },
      null,
      2,
    ),
  })

  const parsed = JSON.parse(extractJsonObject(response.text)) as Partial<ChapterPlan>

  return {
    ...fallbackPlan,
    objective: parsed.objective ?? fallbackPlan.objective,
    sceneCards: parsed.sceneCards ?? fallbackPlan.sceneCards,
    requiredCharacterIds: parsed.requiredCharacterIds ?? fallbackPlan.requiredCharacterIds,
    requiredLocationIds: parsed.requiredLocationIds ?? fallbackPlan.requiredLocationIds,
    requiredFactionIds: parsed.requiredFactionIds ?? fallbackPlan.requiredFactionIds,
    requiredItemIds: parsed.requiredItemIds ?? fallbackPlan.requiredItemIds,
    eventOutline: parsed.eventOutline ?? fallbackPlan.eventOutline,
    hookPlan: parsed.hookPlan ?? fallbackPlan.hookPlan,
    statePredictions: parsed.statePredictions ?? fallbackPlan.statePredictions,
    memoryCandidates: parsed.memoryCandidates ?? fallbackPlan.memoryCandidates,
  }
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
