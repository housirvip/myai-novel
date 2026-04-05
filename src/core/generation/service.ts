import type { ChapterDraft, LlmAdapter, WriteNextResult, WritingContext } from '../../shared/types/domain.js'
import { readLlmStageConfig } from '../../shared/utils/env.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { WritingContextBuilder } from '../context/writing-context-builder.js'

export class GenerationService {
  constructor(
    private readonly writingContextBuilder: WritingContextBuilder,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async writeNext(chapterId: string): Promise<WriteNextResult> {
    const context = await this.writingContextBuilder.buildAsync(chapterId)
    const timestamp = nowIso()
    const draft = this.llmAdapter
      ? await createLlmDraft(this.llmAdapter, context, timestamp)
      : createRuleBasedDraft(context, timestamp)

    await this.chapterDraftRepository.createAsync(draft)
    await this.chapterRepository.markDraftedAsync(chapterId, draft.versionId, undefined, timestamp)

    return {
      chapterId,
      chapterStatus: 'drafted',
      draftId: draft.id,
      actualWordCount: draft.actualWordCount,
      llmMetadata: draft.llmMetadata,
      nextAction: 'review',
    }
  }
}

async function createLlmDraft(
  llmAdapter: LlmAdapter,
  context: WritingContext,
  timestamp: string,
): Promise<ChapterDraft> {
  const llmStage = readLlmStageConfig('generation')
  const response = await llmAdapter.generateText({
    system: [
      '你是长篇小说正文写作助手。你要写的是可直接阅读的章节正文，而不是提纲、摘要、设定说明或分析报告。',
      '必须保持小说感：通过场景、动作、对话、感官细节和人物心理推进剧情，尽量少用抽象总结句。',
      '必须满足以下硬约束：承接上一章局势、完成本章目标、呼应主题、避免违背角色/物品/Hook/记忆真源、结尾形成下一章牵引。',
      '必须保持叙事视角稳定、人物行为动机可解释、情绪递进自然、场景转换清晰。',
      '必须严格执行场景任务包：每个场景都要兑现其冲突推进、信息释放、情绪变化与结果清单。',
      '必须显式照顾高压力 Hook、关键债务与受保护事实，不能只写成宽泛剧情摘要。',
      '不要把输入中的 JSON 字段名、标题或说明性标签原样写进正文。不要输出 markdown 代码块、不要解释写作思路。',
      '如果有关键状态约束，请把它自然地转化为正文事实，而不是生硬罗列。',
      '请直接输出章节正文。',
    ].join(' '),
    user: JSON.stringify(buildGenerationPromptPayload(context), null, 2),
    metadata: {
      stage: 'generation',
      providerHint: llmStage.provider,
      modelHint: llmStage.model,
      timeoutMs: llmStage.timeoutMs,
      maxRetries: llmStage.maxRetries,
      traceId: `generation:${context.chapter.id}`,
    },
  })

  return {
    id: createId('draft'),
    bookId: context.book.id,
    chapterId: context.chapter.id,
    versionId: createId('draft_version'),
    chapterPlanId: context.chapterPlan.id,
    content: response.text.trim(),
    actualWordCount: estimateWordCount(response.text),
    llmMetadata: response.metadata,
    createdAt: timestamp,
  }
}

function buildGenerationPromptPayload(context: WritingContext): Record<string, unknown> {
  return {
    task: {
      kind: 'chapter-draft-writing',
      deliverable: '输出可阅读的小说章节正文',
      mustDo: [
        '承接上一章局势',
        '完成本章目标',
        '推进至少一条核心冲突',
        '自然体现角色当前状态、关键物品、活跃 Hook 与记忆约束',
        '结尾形成新的局势变化或悬念牵引',
        '如果存在当前章 mission，必须在正文中形成可识别的 mission 执行与结果',
        '如果存在 carryIn / carryOut 任务，必须写出承接与交棒，而不是只在说明里提到',
        '如果存在 ending drive，结尾必须兑现该牵引，不能停留在中性收束',
      ],
      qualityBar: [
        '像小说，不像提纲',
        '有具体场面，不只总结',
        '人物行为与心理有因果链',
        '环境描写服务情绪和情节',
        '节奏有起伏，不要全篇同一密度',
      ],
      avoid: [
        '大段空泛概述',
        '把状态清单直接抄进正文',
        '忽略结尾牵引',
        '人物动机跳变',
        '只解释发生了什么而不展示过程',
      ],
    },
    chapterContext: {
      bookTitle: context.book.title,
      chapterTitle: context.chapter.title,
      chapterObjective: context.chapter.objective,
      plannedBeats: context.chapter.plannedBeats,
      volumeTitle: context.volume.title,
      volumeGoal: context.volume.goal,
      volumeSummary: context.volume.summary,
      theme: context.outline.theme,
      premise: context.outline.premise,
      coreConflicts: context.outline.coreConflicts,
      previousChapterSummary: context.previousChapter?.summary,
    },
    volumeDirector: {
      volumePlan: context.volumePlan,
      currentChapterMission: context.currentChapterMission,
      activeStoryThreads: context.activeStoryThreads,
      endingReadiness: context.endingReadiness,
      characterPresenceWindows: context.characterPresenceWindows,
      ensembleBalanceReport: context.ensembleBalanceReport,
      chapterPlanDirectives: {
        missionId: context.chapterPlan.missionId,
        missionSummary: context.currentChapterMission?.summary,
        missionSuccessSignal: context.currentChapterMission?.successSignal,
        threadFocus: context.chapterPlan.threadFocus,
        windowRole: context.chapterPlan.windowRole,
        carryInTasks: context.chapterPlan.carryInTasks,
        carryOutTasks: context.chapterPlan.carryOutTasks,
        ensembleFocusCharacterIds: context.chapterPlan.ensembleFocusCharacterIds,
        subplotCarryThreadIds: context.chapterPlan.subplotCarryThreadIds,
        endingDrive: context.chapterPlan.endingDrive,
        hardExecutionRules: context.writingQualityContract.volumeExecutionRules,
      },
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
      activeHookStates: context.activeHookStates,
      hookPressures: context.hookPressures,
      hookPlan: context.chapterPlan.hookPlan,
      narrativePressure: context.narrativePressure,
      memoryRecall: context.memoryRecall,
      protectedFactConstraints: context.protectedFactConstraints,
    },
    sceneTasks: context.sceneTasks,
    writingPlan: {
      sceneCards: context.chapterPlan.sceneCards,
      eventOutline: context.chapterPlan.eventOutline,
      statePredictions: context.chapterPlan.statePredictions,
      endingDrive: context.chapterPlan.endingDrive,
      mustResolveDebts: context.chapterPlan.mustResolveDebts,
      mustAdvanceHooks: context.chapterPlan.mustAdvanceHooks,
      mustPreserveFacts: context.chapterPlan.mustPreserveFacts,
    },
    qualityContract: context.writingQualityContract,
    styleGuidelines: {
      toneConstraints: context.toneConstraints,
      narrativeVoice: context.narrativeVoiceConstraint,
      emotionalCurve: context.emotionalCurve,
      prosePreference: '用具体动作、对话、感官、心理细节推进，不要写成摘要',
      endingGoal: context.chapterPlan.endingDrive,
    },
  }
}

function createRuleBasedDraft(context: WritingContext, timestamp: string): ChapterDraft {
  const content = buildDraftContent(context)

  return {
    id: createId('draft'),
    bookId: context.book.id,
    chapterId: context.chapter.id,
    versionId: createId('draft_version'),
    chapterPlanId: context.chapterPlan.id,
    content,
    actualWordCount: estimateWordCount(content),
    createdAt: timestamp,
  }
}

function buildDraftContent(context: WritingContext): string {
  const sceneTaskSection = context.sceneTasks.goals.length > 0
    ? [
        '## 场景任务',
        '',
        ...context.sceneTasks.goals.map((goal) => {
          const constraint = context.sceneTasks.constraints.find((item) => item.sceneTitle === goal.sceneTitle)
          const emotion = context.sceneTasks.emotionalTargets.find((item) => item.sceneTitle === goal.sceneTitle)
          const outcome = context.sceneTasks.outcomeChecklist.find((item) => item.sceneTitle === goal.sceneTitle)

          return [
            `- 场景=${goal.sceneTitle}`,
            `  - 冲突推进=${goal.conflict}`,
            `  - 信息释放=${goal.informationReveal}`,
            `  - 情绪变化=${goal.emotionalShift}`,
            `  - 必含=${constraint?.mustInclude.join(' / ') || '无'}`,
            `  - 禁止=${constraint?.mustAvoid.join(' / ') || '无'}`,
            `  - 保护事实=${constraint?.protectedFacts.join(' / ') || '无'}`,
            `  - 起始情绪=${emotion?.startingEmotion ?? '无'} -> 目标情绪=${emotion?.targetEmotion ?? '无'} (${emotion?.intensity ?? 'medium'})`,
            `  - 结果清单=${outcome?.mustHappen.join(' / ') || '无'}`,
          ].join('\n')
        }),
        '',
      ]
    : []
  const volumeDirectorSection =
    context.currentChapterMission ||
    context.chapterPlan.threadFocus.length > 0 ||
    context.chapterPlan.carryInTasks.length > 0 ||
    context.chapterPlan.carryOutTasks.length > 0 ||
    context.chapterPlan.ensembleFocusCharacterIds.length > 0 ||
    context.chapterPlan.subplotCarryThreadIds.length > 0 ||
    context.volumePlan
      ? [
          '## 卷级导演约束',
          '',
          `- 卷计划焦点=${context.volumePlan?.focusSummary ?? `围绕卷目标“${context.volume.goal}”持续推进`}`,
          `- 当前 mission=${context.currentChapterMission?.summary ?? context.chapterPlan.carryInTasks[0] ?? '无'}`,
          `- mission 成功信号=${context.currentChapterMission?.successSignal ?? context.chapterPlan.carryOutTasks[0] ?? '无'}`,
          `- 线程焦点=${context.chapterPlan.threadFocus.join(' / ') || '无'}`,
          `- 窗口职责=${context.chapterPlan.windowRole ?? '无'}`,
          `- 承接任务=${context.chapterPlan.carryInTasks.join(' / ') || '无'}`,
          `- 后续任务=${context.chapterPlan.carryOutTasks.join(' / ') || '无'}`,
          `- 群像聚焦=${context.chapterPlan.ensembleFocusCharacterIds.join(' / ') || '无'}`,
          `- 支线承接=${context.chapterPlan.subplotCarryThreadIds.join(' / ') || '无'}`,
          ...context.writingQualityContract.volumeExecutionRules.map((item) => `- 执行规则=${item}`),
          '',
        ]
      : []
  const characterStatesSection = context.characterStates.length > 0
    ? [
        '## 角色当前状态',
        '',
        ...context.characterStates.map(
          (state) =>
            `- 角色（${state.characterId}）：当前位置=${state.currentLocationId ?? '未知'}；状态=${state.statusNotes.join(' / ') || '无'}`,
        ),
        '',
      ]
    : []
  const hookSection = context.chapterPlan.hookPlan.length > 0 || context.activeHookStates.length > 0
    ? [
        '## 钩子约束',
        '',
        ...context.chapterPlan.hookPlan.map((item) => {
          const activeState = context.activeHookStates.find((candidate) => candidate.hookId === item.hookId)

          return `- Hook（${item.hookId}）：动作=${item.action}；当前状态=${activeState?.status ?? 'unknown'}；说明=${item.note}`
        }),
        '',
      ]
    : []
  const sceneSections = context.chapterPlan.sceneCards
    .map((scene, index) => {
      const beats = scene.beats.map((beat) => `- ${beat}`).join('\n')

      return `## 场景 ${index + 1}：${scene.title}\n\n${scene.purpose}\n\n${beats}`
    })
    .join('\n\n')
  const importantItemsSection = context.importantItems.length > 0
    ? [
        '## 关键物品状态',
        '',
        ...context.importantItems.map(
          (item) =>
            `- ${item.name}（${item.id}）：数量=${item.quantity}${item.unit}；状态=${item.status}；持有者=${item.ownerCharacterId ?? '未知'}；地点=${item.locationId ?? '未知'}`,
        ),
        '',
      ]
    : []
  const writingConstraintSection = [
    '## 写作约束',
    '',
    `- 结尾驱动：${context.chapterPlan.endingDrive}`,
    ...context.chapterPlan.mustResolveDebts.map((item) => `- 必须承接债务：${item}`),
    ...context.chapterPlan.mustAdvanceHooks.map((item) => `- 必须推进 Hook：${item}`),
    ...context.chapterPlan.mustPreserveFacts.map((item) => `- 必须保护事实：${item}`),
    ...context.writingQualityContract.sceneExecutionRules.map((item) => `- 场景执行规则：${item}`),
    ...context.writingQualityContract.stateConsistencyRules.map((item) => `- 一致性规则：${item}`),
    ...context.writingQualityContract.volumeExecutionRules.map((item) => `- 卷级执行规则：${item}`),
    ...context.writingQualityContract.proseQualityRules.map((item) => `- 正文质量规则：${item}`),
    ...context.toneConstraints.map((item) => `- 风格约束[${item.label}]：${item.requirement}`),
    `- 叙事视角：${context.narrativeVoiceConstraint.pointOfView} / ${context.narrativeVoiceConstraint.tense} / ${context.narrativeVoiceConstraint.distance}`,
    `- 视角稳定要求：${context.narrativeVoiceConstraint.stabilityRequirement}`,
    `- 情绪曲线：${context.emotionalCurve.openingEmotion} -> ${context.emotionalCurve.midEmotion} -> ${context.emotionalCurve.endingEmotion} (${context.emotionalCurve.targetIntensity})`,
    '',
  ]
  const memorySection =
    context.memoryRecall.shortTermSummaries.length > 0 ||
    context.memoryRecall.observationEntries.length > 0 ||
    context.memoryRecall.relevantLongTermEntries.length > 0
      ? [
          '## 记忆约束',
          '',
          ...context.memoryRecall.shortTermSummaries.map((item) => `- 最近摘要：${item}`),
          ...context.memoryRecall.recentEvents.map((item) => `- 最近事件：${item}`),
          ...context.memoryRecall.observationEntries.map((entry) => `- 待观察事实：${entry.summary}`),
          ...context.memoryRecall.relevantLongTermEntries.map((entry) => `- 长期记忆：${entry.summary}`),
          '',
        ]
      : []

  return [
    `# ${context.chapter.title}`,
    '',
    `本章目标：${context.chapter.objective}`,
    `卷目标：${context.volume.goal}`,
    `主题呼应：${context.outline.theme}`,
    '',
    '## 章节草稿',
    '',
    `故事发生在《${context.book.title}》的当前主线推进阶段。`,
    context.previousChapter
      ? `上一章《${context.previousChapter.title}》留下的局势仍在持续发酵。`
      : '这是故事前期的重要起势章节，需要尽快建立主角处境与冲突压力。',
    '',
    ...sceneTaskSection,
    ...volumeDirectorSection,
    ...writingConstraintSection,
    ...characterStatesSection,
    ...memorySection,
    ...importantItemsSection,
    ...hookSection,
    sceneSections,
    '',
    '## 本章事件提要',
    '',
    ...context.chapterPlan.eventOutline.map((item) => `- ${item}`),
    '',
    '## 结尾推进',
    '',
    context.chapterPlan.endingDrive,
  ].join('\n')
}

function estimateWordCount(content: string): number {
  return content.replace(/\s+/g, '').length
}
