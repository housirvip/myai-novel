import assert from 'node:assert/strict'
import test from 'node:test'

import type { WritingContext } from '../../../../src/shared/types/domain.js'
import { __generationServiceTestables } from '../../../../src/core/generation/service.js'

function createWritingContext(): WritingContext {
  return {
    book: { id: 'book-1', title: '测试小说' },
    outline: { theme: '命运', premise: '少年卷入阴谋', coreConflicts: ['王城阴谋'] },
    chapter: {
      id: 'chapter-1',
      title: '暗潮',
      objective: '查明敌营动向',
      plannedBeats: ['潜入据点', '发现密信'],
    },
    volume: { id: 'volume-1', title: '第一卷', goal: '逼近真相', summary: '第一卷摘要' },
    previousChapter: { id: 'chapter-0', title: '前夜', summary: '上一章余波' },
    characterStates: [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }],
    characterArcs: [],
    importantItems: [{ id: 'map', name: '地图', quantity: 1, unit: '份', status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }],
    activeHookStates: [{ hookId: 'hook-1', status: 'open' }],
    hookPressures: [],
    narrativePressure: {},
    protectedFactConstraints: ['角色 hero 必须仍在 fortress'],
    memoryRecall: {
      shortTermSummaries: ['主角得知敌营异动'],
      recentEvents: ['密探失踪'],
      observationEntries: [{ summary: '敌营守卫异常' }],
      relevantLongTermEntries: [{ summary: '王城旧案' }],
    },
    volumePlan: { focusSummary: '围绕卷目标持续推进' },
    activeStoryThreads: [],
    currentChapterMission: { summary: '推进王城线', successSignal: '至少推进一条卷级线程' },
    endingReadiness: null,
    characterPresenceWindows: [],
    ensembleBalanceReport: { suggestedReturnCharacterIds: [], subplotCarryRequirements: [] },
    chapterPlan: {
      id: 'plan-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      versionId: 'plan-version-1',
      objective: '查明敌营动向',
      sceneCards: [
        {
          title: '开场铺垫',
          purpose: '建立目标与冲突',
          beats: ['潜入据点', '观察守卫'],
          characterIds: ['hero'],
          factionIds: [],
          itemIds: ['map'],
          locationId: 'fortress',
        },
      ],
      sceneGoals: [{ sceneTitle: '开场铺垫', conflict: '潜入敌营', informationReveal: '发现守卫异常', emotionalShift: '从谨慎到紧张' }],
      sceneConstraints: [{ sceneTitle: '开场铺垫', mustInclude: ['潜入'], mustAvoid: ['空泛解释'], protectedFacts: ['角色 hero 必须仍在 fortress'] }],
      sceneEmotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' }],
      sceneOutcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
      requiredCharacterIds: ['hero'],
      requiredLocationIds: ['fortress'],
      requiredFactionIds: [],
      requiredItemIds: ['map'],
      eventOutline: ['潜入据点', '发现密信'],
      hookPlan: [{ hookId: 'hook-1', action: 'advance', note: '推进旧谜团' }],
      statePredictions: ['hero：获得新线索'],
      memoryCandidates: ['敌营异动'],
      highPressureHookIds: ['hook-1'],
      characterArcTargets: [],
      debtCarryTargets: [],
      threadFocus: ['thread-1'],
      carryInTasks: ['承接前夜局势'],
      carryOutTasks: ['把线索交棒到下一章'],
      ensembleFocusCharacterIds: [],
      subplotCarryThreadIds: [],
      endingDrive: '章末抛出新悬念',
      mustResolveDebts: [],
      mustAdvanceHooks: ['hook-1'],
      mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
      createdAt: '2026-04-06T00:00:00.000Z',
      approvedByUser: false,
    },
    sceneTasks: {
      goals: [{ sceneTitle: '开场铺垫', conflict: '潜入敌营', informationReveal: '发现守卫异常', emotionalShift: '从谨慎到紧张' }],
      constraints: [{ sceneTitle: '开场铺垫', mustInclude: ['潜入'], mustAvoid: ['空泛解释'], protectedFacts: ['角色 hero 必须仍在 fortress'] }],
      emotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' }],
      outcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
    },
    writingQualityContract: {
      sceneExecutionRules: ['每个场景都要兑现冲突推进'],
      stateConsistencyRules: ['不能违背角色当前位置'],
      volumeExecutionRules: ['mission 必须进入正文'],
      endingDriveRule: '结尾必须形成牵引',
      proseQualityRules: ['像小说，不像提纲'],
    },
    toneConstraints: [{ label: '整体风格', requirement: '保持压迫感' }],
    narrativeVoiceConstraint: {
      pointOfView: 'third-person-limited',
      tense: 'past',
      distance: 'close',
      stabilityRequirement: '保持单一视角稳定',
    },
    emotionalCurve: {
      openingEmotion: '谨慎',
      midEmotion: '紧张',
      endingEmotion: '悬置',
      targetIntensity: 'high',
    },
  } as unknown as WritingContext
}

test('buildGenerationPromptPayload preserves mission, state and writing constraints in payload', () => {
  const context = createWritingContext()
  const payload = __generationServiceTestables.buildGenerationPromptPayload(context)

  assert.equal((payload.task as any).kind, 'chapter-draft-writing')
  assert.equal((payload.chapterContext as any).chapterTitle, '暗潮')
  assert.equal((payload.volumeDirector as any).chapterPlanDirectives.missionSummary, '推进王城线')
  assert.deepEqual((payload.writingPlan as any).eventOutline, ['潜入据点', '发现密信'])
  assert.equal((payload.styleGuidelines as any).endingGoal, '章末抛出新悬念')
})

test('buildDraftContent renders key sections for scene tasks, volume directives and constraints', () => {
  const context = createWritingContext()
  const content = __generationServiceTestables.buildDraftContent(context)

  assert.match(content, /# 暗潮/)
  assert.match(content, /## 场景任务/)
  assert.match(content, /## 卷级导演约束/)
  assert.match(content, /## 角色当前状态/)
  assert.match(content, /## 钩子约束/)
  assert.match(content, /## 写作约束/)
  assert.match(content, /## 记忆约束/)
  assert.match(content, /结尾驱动：章末抛出新悬念/)
})

test('createRuleBasedDraft and estimateWordCount produce stable fallback draft output', () => {
  const context = createWritingContext()
  const draft = __generationServiceTestables.createRuleBasedDraft(context, '2026-04-06T00:00:00.000Z')

  assert.equal(draft.bookId, 'book-1')
  assert.equal(draft.chapterId, 'chapter-1')
  assert.equal(draft.chapterPlanId, 'plan-1')
  assert.equal(draft.createdAt, '2026-04-06T00:00:00.000Z')
  assert.equal(draft.actualWordCount, __generationServiceTestables.estimateWordCount(draft.content))
  assert.ok(draft.content.includes('## 本章事件提要'))
})