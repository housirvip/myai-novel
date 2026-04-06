import type { WritingContext } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { PlanningContextBuilder } from './planning-context-builder.js'

/**
 * `WritingContextBuilder` 负责把 `PlanningContext + ChapterPlan` 进一步收束成 `WritingContext`。
 *
 * 它回答的是 generation 阶段真正需要的两个问题：
 * - 当前章应该执行哪些 scene / mission / carry / ending 约束
 * - 这些约束如何被整理成模型或 fallback 草稿可以直接消费的写作任务包
 */
export class WritingContextBuilder {
  constructor(
    private readonly planningContextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
  ) {}

  /**
   * 同步构建 generation 使用的 `WritingContext`。
   */
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
        volumeExecutionRules: [
          ...(planningContext.currentChapterMission
            ? [
                `必须让当前章 mission 可被读者感知：${planningContext.currentChapterMission.summary}`,
                `必须形成可验证的 mission 成功信号：${planningContext.currentChapterMission.successSignal}`,
              ]
            : []),
          ...chapterPlan.threadFocus.slice(0, 3).map((item) => `必须推动卷级线程焦点：${item}`),
          ...chapterPlan.carryInTasks.slice(0, 2).map((item) => `必须在正文前半段承接输入任务：${item}`),
          ...chapterPlan.carryOutTasks.slice(0, 2).map((item) => `必须在正文后半段形成输出任务：${item}`),
          ...chapterPlan.ensembleFocusCharacterIds.slice(0, 2).map((item) => `必须给群像焦点角色留下有效戏份：${item}`),
          ...chapterPlan.subplotCarryThreadIds.slice(0, 2).map((item) => `必须重新挂回支线线程：${item}`),
          ...(chapterPlan.endingDrive.trim() ? [`必须让结尾兑现卷级牵引：${chapterPlan.endingDrive}`] : []),
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

  /**
   * 异步构建 generation 使用的 `WritingContext`。
   */
  async buildAsync(chapterId: string): Promise<WritingContext> {
    const planningContext = await this.planningContextBuilder.buildAsync(chapterId)

    if (!planningContext.chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing. Run `novel plan chapter <id>`.')
    }

    const chapterPlan = await this.chapterPlanRepository.getByVersionIdAsync(
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
        volumeExecutionRules: [
          ...(planningContext.currentChapterMission
            ? [
                `必须让当前章 mission 可被读者感知：${planningContext.currentChapterMission.summary}`,
                `必须形成可验证的 mission 成功信号：${planningContext.currentChapterMission.successSignal}`,
              ]
            : []),
          ...chapterPlan.threadFocus.slice(0, 3).map((item) => `必须推动卷级线程焦点：${item}`),
          ...chapterPlan.carryInTasks.slice(0, 2).map((item) => `必须在正文前半段承接输入任务：${item}`),
          ...chapterPlan.carryOutTasks.slice(0, 2).map((item) => `必须在正文后半段形成输出任务：${item}`),
          ...chapterPlan.ensembleFocusCharacterIds.slice(0, 2).map((item) => `必须给群像焦点角色留下有效戏份：${item}`),
          ...chapterPlan.subplotCarryThreadIds.slice(0, 2).map((item) => `必须重新挂回支线线程：${item}`),
          ...(chapterPlan.endingDrive.trim() ? [`必须让结尾兑现卷级牵引：${chapterPlan.endingDrive}`] : []),
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
