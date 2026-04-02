import type { ChapterPlan, LlmAdapter, PlanningContext } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { extractJsonObject } from '../../shared/utils/json.js'
import { nowIso } from '../../shared/utils/time.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { PlanningContextBuilder } from '../context/planning-context-builder.js'

export class PlanningService {
  constructor(
    private readonly contextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async planChapter(chapterId: string): Promise<ChapterPlan> {
    const context = this.contextBuilder.build(chapterId)
    const plan = this.llmAdapter
      ? await createLlmPlan(this.llmAdapter, context)
      : createRuleBasedPlan(context)

    this.chapterPlanRepository.create(plan)
    this.chapterRepository.updateCurrentPlanVersion(chapterId, plan.versionId, plan.createdAt)

    return plan
  }
}

async function createLlmPlan(llmAdapter: LlmAdapter, context: PlanningContext): Promise<ChapterPlan> {
  const fallbackPlan = createRuleBasedPlan(context)
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

function createRuleBasedPlan(context: PlanningContext): ChapterPlan {
  const timestamp = nowIso()
  const previousChapterSummary = context.previousChapter
    ? `承接上一章《${context.previousChapter.title}》的推进结果。`
    : '作为开篇章节建立世界与主角当前局势。'
  const requiredItemIds = context.importantItems.slice(0, 2).map((item) => item.id)
  const importantItemBeat = context.importantItems[0]
    ? `确保关键物品 ${context.importantItems[0].name} 在本章保持状态连续。`
    : undefined
  const memoryBeat = context.memoryRecall.recentEvents[0]
    ? `承接最近事件：${context.memoryRecall.recentEvents[0]}`
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
          `点明本章目标：${context.chapter.objective}`,
          `引入卷目标压力：${context.volume.goal}`,
        ],
        characterIds: [],
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
        characterIds: [],
        factionIds: [],
        itemIds: requiredItemIds,
      },
    ],
    requiredCharacterIds: [],
    requiredLocationIds: [],
    requiredFactionIds: [],
    requiredItemIds,
    eventOutline: [
      `围绕章节目标推进：${context.chapter.objective}`,
      `呼应卷目标：${context.volume.goal}`,
      `至少推进一条核心冲突：${context.outline.coreConflicts[0]}`,
      ...(importantItemBeat ? [importantItemBeat] : []),
    ],
    hookPlan: [],
    statePredictions: [
      '更新当前章节推进位置',
      '记录本章形成的关键事件',
      ...(context.memoryRecall.relevantLongTermEntries.length > 0 ? ['避免与高重要长期记忆冲突'] : []),
    ],
    memoryCandidates: [
      `${context.chapter.title} 的关键事件摘要`,
      `${context.chapter.objective} 对主线造成的推进结果`,
      ...context.memoryRecall.relevantLongTermEntries.slice(0, 2).map((entry) => `承接长期记忆：${entry.summary}`),
    ],
    createdAt: timestamp,
    approvedByUser: false,
  }
}
