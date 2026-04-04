import type { WritingContext } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { PlanningContextBuilder } from './planning-context-builder.js'

export class WritingContextBuilder {
  constructor(
    private readonly planningContextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
  ) {}

  build(chapterId: string): WritingContext {
    const planningContext = this.planningContextBuilder.build(chapterId)

    if (!planningContext.chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing. Run `novel plan chapter <id>`.')
    }

    const chapterPlan = this.chapterPlanRepository.getByVersionId(
      chapterId,
      planningContext.chapter.currentPlanVersionId,
    )

    if (!chapterPlan) {
      throw new NovelError('Current chapter plan is missing. Run `novel plan chapter <id>`.')
    }

    return {
      ...planningContext,
      chapterPlan,
      sceneTasks: {
        goals: chapterPlan.sceneGoals,
        constraints: chapterPlan.sceneConstraints,
        emotionalTargets: chapterPlan.sceneEmotionalTargets,
        outcomeChecklist: chapterPlan.sceneOutcomeChecklist,
      },
      writingQualityContract: {
        sceneExecutionRules: [
          '每个场景都必须完成自身目标，不可只做解释性铺垫。',
          '场景职责必须覆盖冲突推进、信息释放或情绪变化中的至少一项。',
        ],
        stateConsistencyRules: [
          '不得破坏既有角色状态、物品状态、Hook 状态与长期事实。',
          '必须承接高压力 Hook 与未解决债务。',
        ],
        endingDriveRule: chapterPlan.endingDrive,
        proseQualityRules: [
          '优先使用动作、对话、心理和感官细节推进。',
          '避免整段摘要式概括盖过场景推进。',
        ],
      },
      toneConstraints: [
        { label: 'genre', requirement: `保持 ${planningContext.book.genre} 类型叙事质感。` },
        { label: 'style-guide', requirement: planningContext.book.styleGuide[0] ?? '保持与当前作品既有风格一致。' },
      ],
      narrativeVoiceConstraint: {
        pointOfView: 'third-person-limited',
        tense: 'past',
        distance: 'close',
        stabilityRequirement: '全章保持稳定近距第三人称，不随意跳切视角。',
      },
      emotionalCurve: {
        openingEmotion: chapterPlan.sceneEmotionalTargets[0]?.startingEmotion ?? '紧张',
        midEmotion: chapterPlan.sceneEmotionalTargets[0]?.targetEmotion ?? '压迫感上升',
        endingEmotion: chapterPlan.sceneEmotionalTargets.at(-1)?.targetEmotion ?? '悬置',
        targetIntensity: chapterPlan.sceneEmotionalTargets.some((item) => item.intensity === 'high') ? 'high' : 'medium',
      },
    }
  }
}
