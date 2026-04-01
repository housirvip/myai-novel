import type { ChapterPlan, PlanningContext } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { PlanningContextBuilder } from '../context/planning-context-builder.js'

export class PlanningService {
  constructor(
    private readonly contextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterRepository: ChapterRepository,
  ) {}

  planChapter(chapterId: string): ChapterPlan {
    const context = this.contextBuilder.build(chapterId)
    const plan = createRuleBasedPlan(context)

    this.chapterPlanRepository.create(plan)
    this.chapterRepository.updateCurrentPlanVersion(chapterId, plan.versionId, plan.createdAt)

    return plan
  }
}

function createRuleBasedPlan(context: PlanningContext): ChapterPlan {
  const timestamp = nowIso()
  const previousChapterSummary = context.previousChapter
    ? `承接上一章《${context.previousChapter.title}》的推进结果。`
    : '作为开篇章节建立世界与主角当前局势。'

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
          `点明本章目标：${context.chapter.objective}`,
          `引入卷目标压力：${context.volume.goal}`,
        ],
        characterIds: [],
        factionIds: [],
        itemIds: [],
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
        itemIds: [],
      },
    ],
    requiredCharacterIds: [],
    requiredLocationIds: [],
    requiredFactionIds: [],
    requiredItemIds: [],
    eventOutline: [
      `围绕章节目标推进：${context.chapter.objective}`,
      `呼应卷目标：${context.volume.goal}`,
      `至少推进一条核心冲突：${context.outline.coreConflicts[0]}`,
    ],
    hookPlan: [],
    statePredictions: [
      '更新当前章节推进位置',
      '记录本章形成的关键事件',
    ],
    memoryCandidates: [
      `${context.chapter.title} 的关键事件摘要`,
      `${context.chapter.objective} 对主线造成的推进结果`,
    ],
    createdAt: timestamp,
    approvedByUser: false,
  }
}
