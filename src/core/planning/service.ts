import type {
  ChapterPlan,
  Hook,
  HookPlan,
  LlmAdapter,
  PlanningContext,
  SceneCard,
  SceneConstraint,
  SceneEmotionalTarget,
  SceneGoal,
  SceneOutcomeChecklist,
  VolumePlan,
} from '../../shared/types/domain.js'
import { readLlmStageConfig } from '../../shared/utils/env.js'
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

/**
 * `PlanningService` 负责把当前章的 planning 真源收束成一份可执行的 `ChapterPlan`。
 *
 * 它的输入真源主要来自：
 * - `PlanningContextBuilder` 拼出的 `PlanningContext`
 * - `HookRepository` 提供的 Hook 定义信息
 *
 * 它的输出真源是：
 * - `ChapterPlanRepository` 中的新 plan 版本
 * - `ChapterRepository.currentPlanVersionId` 的更新
 *
 * 这里保留了双轨语义：
 * - 有 LLM 时，优先生成结构化计划并做 normalize 收口
 * - 无 LLM 时，退化到 `createRuleBasedPlan()`，保证主链仍可继续推进
 */
export class PlanningService {
  constructor(
    private readonly contextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly llmAdapter: LlmAdapter | null,
    private readonly hookRepository: HookRepository,
  ) {}

  /**
   * 为指定章节生成当前有效的单章计划，并把版本写回 chapter 真源。
   *
   * 如果当前上下文尚未存在 `volumePlan`，这里会先用 `planVolumeWindow()` 推导一个最小卷级窗口，
   * 以保证单章 planning 仍然拥有 mission / thread / carry 语义，而不是退化成孤立章节。
   */
  async planChapter(chapterId: string): Promise<ChapterPlan> {
    const baseContext = await this.contextBuilder.buildAsync(chapterId)
    const derivedVolumePlan = baseContext.volumePlan ?? this.planVolumeWindow(baseContext)
    const context = baseContext.volumePlan
      ? baseContext
      : {
          ...baseContext,
          volumePlan: derivedVolumePlan,
          currentChapterMission:
            derivedVolumePlan.chapterMissions.find((mission) => mission.chapterId === baseContext.chapter.id) ?? null,
        }
    const activeHooks = buildActiveHookViews(context, await this.hookRepository.listByBookIdAsync(context.book.id))
    const plan = this.llmAdapter
      ? await createLlmPlan(this.llmAdapter, context, activeHooks)
      : createRuleBasedPlan(context, activeHooks)

    await this.chapterPlanRepository.createAsync(plan)
    await this.chapterRepository.updateCurrentPlanVersionAsync(chapterId, plan.versionId, plan.createdAt)

    return plan
  }

  /**
   * 基于当前章位置推导一个最小卷级滚动窗口。
   *
   * 这个方法不直接替代 `VolumePlanRepository` 的持久化卷计划，
   * 它的职责是：当卷级导演真源还不完整时，先为接下来 `2-3` 章建立一个可连续推进的 mission 窗口。
   */
  planVolumeWindow(context: PlanningContext): VolumePlan {
    const timestamp = nowIso()
    const chaptersInWindow = this.chapterRepository
      .listByBookId(context.book.id)
      .filter((chapter) => chapter.volumeId === context.volume.id && chapter.index >= context.chapter.index)
      .slice(0, 3)
    const focusThreads = context.activeStoryThreads.slice(0, 3)
    const fallbackThreadId = focusThreads[0]?.id ?? `${context.volume.id}_window_thread`
    /**
     * 这里的 mission 分配规则不是“平均分配任务”，而是为未来 3 章建立一个最小可连续的导演窗口：
     * - 第 1 章优先承担当前章的主推进责任，避免窗口起点失焦
     * - 中间章默认负责 complicate，确保线程不是只推进不加压
     * - 窗口尾章优先承担 payoff / 交棒职责，为下一次滚动规划留接口
     *
     * 这也是 `currentChapterMission` 与“未来窗口任务”的连接点：当前章不是孤立的，而是整个窗口的起笔。
     */
    const chapterMissions: VolumePlan['chapterMissions'] = chaptersInWindow.map((chapter, index) => ({
      id: createId('mission'),
      bookId: context.book.id,
      volumeId: context.volume.id,
      chapterId: chapter.id,
      threadId: focusThreads[index % Math.max(focusThreads.length, 1)]?.id ?? fallbackThreadId,
      missionType: index === 0 ? 'advance' : (index === chaptersInWindow.length - 1 ? 'payoff' : 'complicate'),
      summary:
        index === 0
          ? `优先推进卷级焦点任务：${context.chapter.objective}`
          : `承接卷级线程并推进 ${chapter.title} 的窗口职责`,
      successSignal:
        index === 0
          ? '当前章对至少一条高优先级线程形成实质推进'
          : '该章对窗口级连续规划形成清晰承接',
      priority: focusThreads[index % Math.max(focusThreads.length, 1)]?.priority ?? 'high',
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    return {
      id: createId('volume_plan'),
      bookId: context.book.id,
      volumeId: context.volume.id,
      title: `${context.volume.title} 滚动窗口计划`,
      focusSummary: context.currentChapterMission?.summary ?? `围绕卷目标“${context.volume.goal}”推进未来章节串。`,
      rollingWindow: {
        windowStartChapterIndex: context.chapter.index,
        windowEndChapterIndex: chaptersInWindow.at(-1)?.index ?? context.chapter.index,
        focusThreadIds: focusThreads.map((thread) => thread.id),
        goal: `在 ${chaptersInWindow.length} 章窗口内持续推进卷目标与高优先级线程。`,
      },
      threadIds: focusThreads.map((thread) => thread.id),
      chapterMissions,
      endingSetupRequirements: (context.endingReadiness?.closureGaps ?? []).slice(0, 2).map((gap, index) => ({
        id: createId(`ending_req_${index}`),
        summary: gap.summary,
        relatedThreadId: gap.relatedThreadId,
        targetChapterIndex: chaptersInWindow.at(-1)?.index,
        status: 'pending',
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  async planVolumeWindowAsync(context: PlanningContext): Promise<VolumePlan> {
    const timestamp = nowIso()
    const chaptersInWindow = (await this.chapterRepository.listByBookIdAsync(context.book.id))
      .filter((chapter) => chapter.volumeId === context.volume.id && chapter.index >= context.chapter.index)
      .slice(0, 3)
    const focusThreads = context.activeStoryThreads.slice(0, 3)
    const fallbackThreadId = focusThreads[0]?.id ?? `${context.volume.id}_window_thread`

    const chapterMissions: VolumePlan['chapterMissions'] = chaptersInWindow.map((chapter, index) => ({
      id: createId('mission'),
      bookId: context.book.id,
      volumeId: context.volume.id,
      chapterId: chapter.id,
      threadId: focusThreads[index % Math.max(focusThreads.length, 1)]?.id ?? fallbackThreadId,
      missionType: index === 0 ? 'advance' : (index === chaptersInWindow.length - 1 ? 'payoff' : 'complicate'),
      summary:
        index === 0
          ? `优先推进卷级焦点任务：${context.chapter.objective}`
          : `承接卷级线程并推进 ${chapter.title} 的窗口职责`,
      successSignal:
        index === 0
          ? '当前章对至少一条高优先级线程形成实质推进'
          : '该章对窗口级连续规划形成清晰承接',
      priority: focusThreads[index % Math.max(focusThreads.length, 1)]?.priority ?? 'high',
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

    return {
      id: createId('volume_plan'),
      bookId: context.book.id,
      volumeId: context.volume.id,
      title: `${context.volume.title} 滚动窗口计划`,
      focusSummary: context.currentChapterMission?.summary ?? `围绕卷目标“${context.volume.goal}”推进未来章节串。`,
      rollingWindow: {
        windowStartChapterIndex: context.chapter.index,
        windowEndChapterIndex: chaptersInWindow.at(-1)?.index ?? context.chapter.index,
        focusThreadIds: focusThreads.map((thread) => thread.id),
        goal: `在 ${chaptersInWindow.length} 章窗口内持续推进卷目标与高优先级线程。`,
      },
      threadIds: focusThreads.map((thread) => thread.id),
      chapterMissions,
      endingSetupRequirements: (context.endingReadiness?.closureGaps ?? []).slice(0, 2).map((gap, index) => ({
        id: createId(`ending_req_${index}`),
        summary: gap.summary,
        relatedThreadId: gap.relatedThreadId,
        targetChapterIndex: chaptersInWindow.at(-1)?.index,
        status: 'pending',
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }
}

async function createLlmPlan(
  llmAdapter: LlmAdapter,
  context: PlanningContext,
  activeHooks: ActiveHookView[],
): Promise<ChapterPlan> {
  // fallback plan 既是无 LLM 时的兜底结果，也是有 LLM 时 normalize 的安全基线。
  const fallbackPlan = createRuleBasedPlan(context, activeHooks)
  const llmStage = readLlmStageConfig('planning')
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
      'JSON 至少包含 objective, sceneCards, sceneGoals, sceneConstraints, sceneEmotionalTargets, sceneOutcomeChecklist, endingDrive, mustResolveDebts, mustAdvanceHooks, mustPreserveFacts, requiredCharacterIds, requiredLocationIds, requiredItemIds, eventOutline, hookPlan, statePredictions, memoryCandidates。',
    ].join(' '),
    user: JSON.stringify(buildPlanningPromptPayload(context, activeHooks), null, 2),
    metadata: {
      stage: 'planning',
      providerHint: llmStage.provider,
      modelHint: llmStage.model,
      timeoutMs: llmStage.timeoutMs,
      maxRetries: llmStage.maxRetries,
      traceId: `planning:${context.chapter.id}`,
    },
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
  const normalizedHighPressureHookIds = normalizeStringArray(parsed.highPressureHookIds, fallbackPlan.highPressureHookIds)
  const normalizedCharacterArcTargets = normalizeStringArray(parsed.characterArcTargets, fallbackPlan.characterArcTargets)
  const normalizedDebtCarryTargets = normalizeStringArray(parsed.debtCarryTargets, fallbackPlan.debtCarryTargets)
  const normalizedSceneGoals = normalizeSceneGoals(parsed.sceneGoals, fallbackPlan.sceneGoals)
  const normalizedSceneConstraints = normalizeSceneConstraints(parsed.sceneConstraints, fallbackPlan.sceneConstraints)
  const normalizedSceneEmotionalTargets = normalizeSceneEmotionalTargets(
    parsed.sceneEmotionalTargets,
    fallbackPlan.sceneEmotionalTargets,
  )
  const normalizedSceneOutcomeChecklist = normalizeSceneOutcomeChecklist(
    parsed.sceneOutcomeChecklist,
    fallbackPlan.sceneOutcomeChecklist,
  )
  const normalizedEndingDrive = typeof parsed.endingDrive === 'string' && parsed.endingDrive.trim().length > 0
    ? parsed.endingDrive.trim()
    : fallbackPlan.endingDrive
  const normalizedMustResolveDebts = normalizeStringArray(parsed.mustResolveDebts, fallbackPlan.mustResolveDebts)
  const normalizedMustAdvanceHooks = normalizeStringArray(parsed.mustAdvanceHooks, fallbackPlan.mustAdvanceHooks)
  const normalizedMustPreserveFacts = normalizeStringArray(parsed.mustPreserveFacts, fallbackPlan.mustPreserveFacts)

  // normalize 的目标不是“尽量保留模型原样输出”，
  // 而是把结果收口成当前主链可安全消费的 ChapterPlan 结构。
  return {
    ...fallbackPlan,
    objective: parsed.objective ?? fallbackPlan.objective,
    sceneCards: normalizedSceneCards,
    sceneGoals: normalizedSceneGoals,
    sceneConstraints: normalizedSceneConstraints,
    sceneEmotionalTargets: normalizedSceneEmotionalTargets,
    sceneOutcomeChecklist: normalizedSceneOutcomeChecklist,
    requiredCharacterIds: normalizedRequiredCharacterIds,
    requiredLocationIds: normalizedRequiredLocationIds,
    requiredFactionIds: normalizedRequiredFactionIds,
    requiredItemIds: normalizedRequiredItemIds,
    eventOutline: normalizedEventOutline,
    hookPlan: normalizedHookPlan,
    statePredictions: normalizedStatePredictions,
    memoryCandidates: normalizedMemoryCandidates,
    highPressureHookIds: normalizedHighPressureHookIds,
    characterArcTargets: normalizedCharacterArcTargets,
    debtCarryTargets: normalizedDebtCarryTargets,
    endingDrive: normalizedEndingDrive,
    mustResolveDebts: normalizedMustResolveDebts,
    mustAdvanceHooks: normalizedMustAdvanceHooks,
    mustPreserveFacts: normalizedMustPreserveFacts,
    llmMetadata: response.metadata,
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
    volumeDirector: {
      volumePlan: context.volumePlan,
      currentChapterMission: context.currentChapterMission,
      activeStoryThreads: context.activeStoryThreads,
      endingReadiness: context.endingReadiness,
      characterPresenceWindows: context.characterPresenceWindows,
      ensembleBalanceReport: context.ensembleBalanceReport,
    },
    stateConstraints: {
      characterStates: context.characterStates.map((state) => ({
        characterId: state.characterId,
        currentLocationId: state.currentLocationId,
        statusNotes: state.statusNotes,
      })),
      characterArcs: context.characterArcs,
      importantItems: context.importantItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        status: item.status,
        ownerCharacterId: item.ownerCharacterId,
        locationId: item.locationId,
      })),
      activeHooks,
      hookPressures: context.hookPressures,
      narrativePressure: context.narrativePressure,
      protectedFactConstraints: context.protectedFactConstraints,
      memoryRecall: context.memoryRecall,
    },
    outputRules: {
      sceneCardGuideline: '建议 2-4 个场景，必须包含开场承接、核心推进、结尾牵引中的至少两类功能',
      eventOutlineGuideline: '使用可执行事件，不要写抽象评价',
      statePredictionGuideline: '尽量具体写出哪些状态将在章末变化',
      hookPlanGuideline: '如果存在活跃 Hook，应给出动作和简短说明',
      sceneTaskGuideline: '每个场景都应声明冲突推进、信息释放、情绪变化与结果清单',
    },
  }
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // 对 planning 来说，空数组往往意味着模型没有真正给出可执行内容，
  // 所以这里宁可回退到 fallback，也不接受“结构正确但语义空心”的输出。
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)

  return normalized.length > 0 ? normalized : fallback
}

function normalizeSceneCards(value: unknown, fallback: ChapterPlan['sceneCards']): ChapterPlan['sceneCards'] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // scene card 是后续 generation 的主要场景任务来源，
  // 因此这里会尽量填齐 title / purpose / beats 的最小可执行结构。
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

  // hook plan 必须保证 hookId 和 action 可读可执行，否则后续 review / approve 很难闭环。
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
    // state predictions 允许模型返回对象数组或字符串数组，最终统一压平为可展示、可存储的文本线。
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

  // memory candidate 只保留未来值得沉淀的内容，空对象或无内容项直接丢弃。
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

function normalizeSceneGoals(value: unknown, fallback: SceneGoal[]): SceneGoal[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // scene goal 直接影响 review 对“场景是否落地”的判断，
  // 因此即使模型漏字段，也要补到一个最小可检查结构。
  const normalized = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const sceneTitle = typeof candidate.sceneTitle === 'string' && candidate.sceneTitle.trim().length > 0
        ? candidate.sceneTitle.trim()
        : `场景 ${index + 1}`
      const conflict = typeof candidate.conflict === 'string' && candidate.conflict.trim().length > 0
        ? candidate.conflict.trim()
        : '推进当前核心冲突'
      const informationReveal = typeof candidate.informationReveal === 'string' && candidate.informationReveal.trim().length > 0
        ? candidate.informationReveal.trim()
        : '释放必要的新信息'
      const emotionalShift = typeof candidate.emotionalShift === 'string' && candidate.emotionalShift.trim().length > 0
        ? candidate.emotionalShift.trim()
        : '让角色处境发生情绪变化'

      return { sceneTitle, conflict, informationReveal, emotionalShift }
    })
    .filter((item): item is SceneGoal => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function normalizeSceneConstraints(value: unknown, fallback: SceneConstraint[]): SceneConstraint[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // constraint 更偏“不能写坏什么”，所以允许数组为空，但要求 sceneTitle 稳定存在。
  const normalized = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const sceneTitle = typeof candidate.sceneTitle === 'string' && candidate.sceneTitle.trim().length > 0
        ? candidate.sceneTitle.trim()
        : `场景 ${index + 1}`

      return {
        sceneTitle,
        mustInclude: normalizeStringArray(candidate.mustInclude, []),
        mustAvoid: normalizeStringArray(candidate.mustAvoid, []),
        protectedFacts: normalizeStringArray(candidate.protectedFacts, []),
      }
    })
    .filter((item): item is SceneConstraint => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function normalizeSceneEmotionalTargets(value: unknown, fallback: SceneEmotionalTarget[]): SceneEmotionalTarget[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // emotional target 主要服务于 review / rewrite 的情绪推进检查，不追求极细颗粒，只求可校验。
  const normalized = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const sceneTitle = typeof candidate.sceneTitle === 'string' && candidate.sceneTitle.trim().length > 0
        ? candidate.sceneTitle.trim()
        : `场景 ${index + 1}`
      const startingEmotion = typeof candidate.startingEmotion === 'string' && candidate.startingEmotion.trim().length > 0
        ? candidate.startingEmotion.trim()
        : '紧张'
      const targetEmotion = typeof candidate.targetEmotion === 'string' && candidate.targetEmotion.trim().length > 0
        ? candidate.targetEmotion.trim()
        : '更强的不确定感'
      const intensity = candidate.intensity === 'low' || candidate.intensity === 'medium' || candidate.intensity === 'high'
        ? candidate.intensity
        : 'medium'

      return { sceneTitle, startingEmotion, targetEmotion, intensity }
    })
    .filter((item): item is SceneEmotionalTarget => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function normalizeSceneOutcomeChecklist(value: unknown, fallback: SceneOutcomeChecklist[]): SceneOutcomeChecklist[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  // outcome checklist 是 generation 和 review 之间的重要桥：
  // 前者把它当成“场景必须兑现什么”，后者再检查正文有没有真正落地。
  const normalized = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as Record<string, unknown>
      const sceneTitle = typeof candidate.sceneTitle === 'string' && candidate.sceneTitle.trim().length > 0
        ? candidate.sceneTitle.trim()
        : `场景 ${index + 1}`

      return {
        sceneTitle,
        mustHappen: normalizeStringArray(candidate.mustHappen, []),
        shouldAdvanceHooks: normalizeStringArray(candidate.shouldAdvanceHooks, []),
        shouldResolveDebts: normalizeStringArray(candidate.shouldResolveDebts, []),
      }
    })
    .filter((item): item is SceneOutcomeChecklist => Boolean(item))

  return normalized.length > 0 ? normalized : fallback
}

function createRuleBasedPlan(context: PlanningContext, activeHooks: ActiveHookView[]): ChapterPlan {
  const timestamp = nowIso()
  // rule-based plan 的目标不是写出“最聪明”的计划，
  // 而是在没有 LLM 时仍给 generation / review 一份结构完整、可执行、可审查的计划基线。
  const previousChapterSummary = context.previousChapter
    ? `承接上一章《${context.previousChapter.title}》的推进结果。`
    : '作为开篇章节建立世界与主角当前局势。'
  const currentMissionSummary =
    context.currentChapterMission?.summary
    ?? context.volumePlan?.focusSummary
    ?? `围绕卷目标“${context.volume.goal}”推进当前章节。`
  const currentMissionSignal =
    context.currentChapterMission?.successSignal
    ?? '本章应对至少一条卷级线程形成可追踪推进。'
  const prioritizedThreads = context.activeStoryThreads.slice(0, 3)
  const threadBeat = prioritizedThreads[0]
    ? `优先推进故事线程《${prioritizedThreads[0].title}》。`
    : undefined
  const endingGapBeat = context.endingReadiness?.closureGaps[0]
    ? `为终局缺口补前置：${context.endingReadiness.closureGaps[0].summary}`
    : undefined
  const highPressureHooks = context.narrativePressure.highPressureHooks.slice(0, 3)
  const ensembleFocusCharacterIds = context.ensembleBalanceReport.suggestedReturnCharacterIds.slice(0, 3)
  const subplotCarryThreadIds = context.ensembleBalanceReport.subplotCarryRequirements.map((item) => item.threadId)
  const ensembleBeat = ensembleFocusCharacterIds[0]
    ? `优先让角色 ${ensembleFocusCharacterIds[0]} 重新回到叙事核心。`
    : undefined
  const subplotBeat = subplotCarryThreadIds[0]
    ? `本章补承接支线线程：${subplotCarryThreadIds[0]}`
    : undefined
  const requiredCharacterIds = uniqueStrings([
    ...ensembleFocusCharacterIds,
    ...context.characterStates.slice(0, 3).map((state) => state.characterId),
    ...context.characterArcs.slice(0, 2).map((arc) => arc.characterId),
  ])
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
  const hookPlan = (highPressureHooks.length > 0
    ? highPressureHooks.map((pressure) => {
        const hook = activeHooks.find((item) => item.hookId === pressure.hookId)
        const status = hook?.status ?? 'open'
        const action = pressure.riskLevel === 'high' ? 'advance' : suggestHookAction(status)

        return {
          hookId: pressure.hookId,
          action,
          note: `优先处理高压力 Hook ${pressure.hookId}，当前压力=${pressure.pressureScore}，风险=${pressure.riskLevel}。`,
        }
      })
    : activeHooks.slice(0, 3).map((hook) => ({
        hookId: hook.hookId,
        action: suggestHookAction(hook.status),
        note: `围绕 Hook《${hook.title}》进行${describeHookAction(suggestHookAction(hook.status))}，避免本章脱离当前伏笔。`,
      })))
  const characterStateBeat = context.characterStates[0]
    ? `承接关键角色 ${context.characterStates[0].characterId} 的当前位置与状态。`
    : undefined
  const arcBeat = context.characterArcs[0]
    ? `推动角色 ${context.characterArcs[0].characterId} 的弧线 ${context.characterArcs[0].arc} 从 ${context.characterArcs[0].currentStage} 继续前进。`
    : undefined
  const hookBeat = hookPlan[0]
    ? `处理活跃 Hook：${hookPlan[0].hookId}，执行 ${hookPlan[0].action}`
    : undefined
  const debtCarryTargets = context.narrativePressure.openNarrativeDebts
    .slice(0, 3)
    .map((item) => `${item.debtType}：${item.summary}`)
  const characterArcTargets = context.characterArcs
    .slice(0, 3)
    .map((item) => `${item.characterId}:${item.arc}:${item.currentStage}`)
  const highPressureHookIds = hookPlan.map((item) => item.hookId)
  const mustResolveDebts = debtCarryTargets.slice(0, 3)
  const mustAdvanceHooks = hookPlan.slice(0, 3).map((item) => item.hookId)
  const mustPreserveFacts = context.protectedFactConstraints.slice(0, 5)
  // 这三组 must-* 约束会被 review / rewrite / approve 继续消费，
  // 是 rule-based plan 里最重要的跨阶段结构化输出之一。
  const endingDrive = hookPlan[0]
    ? `在章末制造与 Hook ${hookPlan[0].hookId} 相关的新悬念或兑现前置动作。`
    : '在章末制造明确的局势变化与下一章牵引。'
  const sceneGoals: SceneGoal[] = [
    {
      sceneTitle: `${context.chapter.title}-开场铺垫`,
      conflict: '把上一章余波与本章目标连接起来',
      informationReveal: '说明当前局势与本章必须处理的压力来源',
      emotionalShift: '从承接态进入紧张推进态',
    },
    {
      sceneTitle: `${context.chapter.title}-核心推进`,
      conflict: '推进本章主冲突并压缩角色选择空间',
      informationReveal: '释放与卷目标、Hook 或债务相关的关键新信息',
      emotionalShift: '把局势推向更高风险或更强牵引',
    },
  ]
  const sceneConstraints: SceneConstraint[] = [
    {
      sceneTitle: `${context.chapter.title}-开场铺垫`,
      mustInclude: uniqueStrings([
        previousChapterSummary,
        `点明本章目标：${context.chapter.objective}`,
        `卷级任务：${currentMissionSummary}`,
        ...(ensembleBeat ? [ensembleBeat] : []),
      ]),
      mustAvoid: ['空转铺垫', '脱离当前状态体系的解释性段落'],
      protectedFacts: mustPreserveFacts,
    },
    {
      sceneTitle: `${context.chapter.title}-核心推进`,
      mustInclude: uniqueStrings([
        ...mustResolveDebts.slice(0, 2),
        ...mustAdvanceHooks.slice(0, 2).map((hookId) => `推进 Hook：${hookId}`),
        ...(subplotBeat ? [subplotBeat] : []),
        endingDrive,
      ]),
      mustAvoid: ['只讲设定不推进事件', '结尾没有新的牵引'],
      protectedFacts: mustPreserveFacts,
    },
  ]
  const sceneEmotionalTargets: SceneEmotionalTarget[] = [
    {
      sceneTitle: `${context.chapter.title}-开场铺垫`,
      startingEmotion: '余波未定',
      targetEmotion: '紧张聚焦',
      intensity: 'medium',
    },
    {
      sceneTitle: `${context.chapter.title}-核心推进`,
      startingEmotion: '紧张聚焦',
      targetEmotion: '高压悬置',
      intensity: highPressureHooks.length > 0 ? 'high' : 'medium',
    },
  ]
  const sceneOutcomeChecklist: SceneOutcomeChecklist[] = [
    {
      sceneTitle: `${context.chapter.title}-开场铺垫`,
      mustHappen: ['建立本章即时任务', '承接上一章局势', currentMissionSignal],
      shouldAdvanceHooks: highPressureHookIds.slice(0, 1),
      shouldResolveDebts: mustResolveDebts.slice(0, 1),
    },
    {
      sceneTitle: `${context.chapter.title}-核心推进`,
      mustHappen: ['主冲突发生实质推进', '章末形成新的牵引'],
      shouldAdvanceHooks: mustAdvanceHooks,
      shouldResolveDebts: mustResolveDebts.slice(0, 2),
    },
  ]

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
          ...(arcBeat ? [arcBeat] : []),
          `点明本章目标：${context.chapter.objective}`,
          `引入卷目标压力：${context.volume.goal}`,
          ...(ensembleBeat ? [ensembleBeat] : []),
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
          ? [...context.chapter.plannedBeats, ...debtCarryTargets.slice(0, 2)]
          : [
              '推进当前核心冲突',
              '形成新的局势变化',
              '在结尾制造下一章牵引力',
              ...debtCarryTargets.slice(0, 2),
            ],
        characterIds: requiredCharacterIds,
        locationId: requiredLocationIds[0],
        factionIds: [],
        itemIds: requiredItemIds,
      },
    ],
    sceneGoals,
    sceneConstraints,
    sceneEmotionalTargets,
    sceneOutcomeChecklist,
    requiredCharacterIds,
    requiredLocationIds,
    requiredFactionIds: [],
    requiredItemIds,
    eventOutline: [
      `围绕章节目标推进：${context.chapter.objective}`,
      `呼应卷目标：${context.volume.goal}`,
      `卷级任务：${currentMissionSummary}`,
      `至少推进一条核心冲突：${context.outline.coreConflicts[0]}`,
      ...(threadBeat ? [threadBeat] : []),
      ...(ensembleBeat ? [ensembleBeat] : []),
      ...(subplotBeat ? [subplotBeat] : []),
      ...(importantItemBeat ? [importantItemBeat] : []),
      ...(hookBeat ? [hookBeat] : []),
      ...(endingGapBeat ? [endingGapBeat] : []),
      ...debtCarryTargets,
    ],
    hookPlan,
    statePredictions: [
      '更新当前章节推进位置',
      '记录本章形成的关键事件',
      '记录本章对卷级线程的推进结果',
      ...(requiredCharacterIds.length > 0 ? ['关键角色状态应在本章后产生可追踪变化'] : []),
      ...(hookPlan.length > 0 ? ['至少一条高压力或活跃 Hook 的状态应在本章后发生推进'] : []),
      ...(context.memoryRecall.relevantLongTermEntries.length > 0 ? ['避免与高重要长期记忆冲突'] : []),
      ...(characterArcTargets.length > 0 ? ['至少一条角色弧线在本章后应进入下一推进阶段'] : []),
      ...(ensembleFocusCharacterIds.length > 0 ? ['至少一名长期缺席角色应在本章重新获得承接'] : []),
    ],
    memoryCandidates: [
      `${context.chapter.title} 的关键事件摘要`,
      `${context.chapter.objective} 对主线造成的推进结果`,
      `卷级任务完成度：${currentMissionSummary}`,
      ...hookPlan.slice(0, 2).map((item) => `Hook ${item.hookId} 在本章的推进结果`),
      ...context.memoryRecall.relevantLongTermEntries.slice(0, 2).map((entry) => `承接长期记忆：${entry.summary}`),
      ...debtCarryTargets.slice(0, 2).map((item) => `待承接债务：${item}`),
    ],
    highPressureHookIds,
    characterArcTargets,
    debtCarryTargets,
    missionId: context.currentChapterMission?.id,
    threadFocus: prioritizedThreads.map((thread) => thread.id),
    windowRole: context.currentChapterMission?.missionType ?? 'advance',
    carryInTasks: uniqueStrings([
      currentMissionSummary,
      ...mustResolveDebts.slice(0, 2),
    ]),
    carryOutTasks: uniqueStrings([
      currentMissionSignal,
      ...mustAdvanceHooks.slice(0, 2).map((hookId) => `后续继续推进 Hook：${hookId}`),
    ]),
    ensembleFocusCharacterIds: context.ensembleBalanceReport.suggestedReturnCharacterIds,
    subplotCarryThreadIds: context.ensembleBalanceReport.subplotCarryRequirements.map((item) => item.threadId),
    endingDrive,
    mustResolveDebts,
    mustAdvanceHooks,
    mustPreserveFacts,
    createdAt: timestamp,
    approvedByUser: false,
  }
}

function buildActiveHookViews(context: PlanningContext, hooks: Hook[]): ActiveHookView[] {
  // 这里把 hook 定义与 current state 合成 planning 友好的视图，
  // 避免 prompt payload 和 rule-based plan 反复自己 join 两份真源。
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

export const __planningServiceTestables = {
  normalizeStringArray,
  normalizeSceneCards,
  normalizeHookPlan,
  normalizeStatePredictions,
  normalizeMemoryCandidates,
  normalizeSceneGoals,
  normalizeSceneConstraints,
  normalizeSceneEmotionalTargets,
  normalizeSceneOutcomeChecklist,
  buildActiveHookViews,
  suggestHookAction,
  describeHookAction,
  createRuleBasedPlan,
}
