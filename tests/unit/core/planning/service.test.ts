import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlanningContext } from '../../../../src/shared/types/domain.js'
import { PlanningService, __planningServiceTestables } from '../../../../src/core/planning/service.js'

test('normalizeSceneCards fills defaults and preserves valid structured fields', () => {
  const fallback = [
    {
      title: 'fallback-scene',
      purpose: 'fallback-purpose',
      beats: ['fallback-beat'],
      characterIds: ['fallback-char'],
      factionIds: [],
      itemIds: [],
    },
  ]

  const normalized = __planningServiceTestables.normalizeSceneCards(
    [
      {
        title: ' 潜入 ',
        purpose: ' 进入敌营 ',
        beats: ['接近目标', '制造伪装'],
        characterIds: ['hero', 'ally'],
        items: ['map'],
        location: 'fortress',
      },
      {
        purpose: '',
      },
    ],
    fallback,
  )

  assert.equal(normalized.length, 2)
  assert.deepEqual(normalized[0], {
    title: '潜入',
    purpose: '进入敌营',
    beats: ['接近目标', '制造伪装'],
    characterIds: ['hero', 'ally'],
    factionIds: [],
    itemIds: ['map'],
    locationId: 'fortress',
  })
  assert.deepEqual(normalized[1], {
    title: '场景 2',
    purpose: '推进章节目标与冲突',
    beats: ['推进当前场景目标'],
    characterIds: [],
    factionIds: [],
    itemIds: [],
  })
})

test('normalizeHookPlan and normalizeStatePredictions accept structured payloads and apply safe defaults', () => {
  const hookFallback = [{ hookId: 'fallback-hook', action: 'hold' as const, note: 'fallback-note' }]
  const predictionFallback = ['fallback-prediction']

  const normalizedHooks = __planningServiceTestables.normalizeHookPlan(
    [
      { hookId: 'hook-1', action: 'payoff', note: ' 完成本章回收 ' },
      { hookId: 'hook-2', action: 'invalid-action' },
      { note: 'missing hook id' },
    ],
    hookFallback,
  )
  const normalizedPredictions = __planningServiceTestables.normalizeStatePredictions(
    {
      characters: [{ characterId: 'hero', change: '获得新线索' }],
      items: [{ itemId: 'map', change: '转移到新持有者' }],
    },
    predictionFallback,
  )

  assert.deepEqual(normalizedHooks, [
    { hookId: 'hook-1', action: 'payoff', note: '完成本章回收' },
    { hookId: 'hook-2', action: 'advance', note: '承接并推进该 Hook。' },
  ])
  assert.deepEqual(normalizedPredictions, ['hero：获得新线索', 'map：转移到新持有者'])
})

test('planning normalize helpers trim values, fill defaults and fall back safely', () => {
  assert.deepEqual(
    __planningServiceTestables.normalizeStringArray([' hero ', '', 'ally'], ['fallback']),
    ['hero', 'ally'],
  )
  assert.deepEqual(
    __planningServiceTestables.normalizeStringArray([], ['fallback']),
    ['fallback'],
  )

  assert.deepEqual(
    __planningServiceTestables.normalizeMemoryCandidates([{ content: ' 关键记忆 ' }, ' 新事件 '], ['fallback']),
    ['关键记忆', '新事件'],
  )

  assert.deepEqual(
    __planningServiceTestables.normalizeSceneGoals(
      [{ sceneTitle: ' 场景一 ', conflict: ' 冲突 ', informationReveal: ' 信息 ', emotionalShift: ' 情绪变化 ' }, {}],
      [],
    ),
    [
      { sceneTitle: '场景一', conflict: '冲突', informationReveal: '信息', emotionalShift: '情绪变化' },
      { sceneTitle: '场景 2', conflict: '推进当前核心冲突', informationReveal: '释放必要的新信息', emotionalShift: '让角色处境发生情绪变化' },
    ],
  )

  assert.deepEqual(
    __planningServiceTestables.normalizeSceneConstraints(
      [{ sceneTitle: ' 场景一 ', mustInclude: ['潜入'], mustAvoid: ['空泛解释'], protectedFacts: ['事实A'] }, {}],
      [],
    ),
    [
      { sceneTitle: '场景一', mustInclude: ['潜入'], mustAvoid: ['空泛解释'], protectedFacts: ['事实A'] },
      { sceneTitle: '场景 2', mustInclude: [], mustAvoid: [], protectedFacts: [] },
    ],
  )

  assert.deepEqual(
    __planningServiceTestables.normalizeSceneEmotionalTargets(
      [{ sceneTitle: ' 场景一 ', startingEmotion: ' 谨慎 ', targetEmotion: ' 紧张 ', intensity: 'high' }, {}],
      [],
    ),
    [
      { sceneTitle: '场景一', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'high' },
      { sceneTitle: '场景 2', startingEmotion: '紧张', targetEmotion: '更强的不确定感', intensity: 'medium' },
    ],
  )

  assert.deepEqual(
    __planningServiceTestables.normalizeSceneOutcomeChecklist(
      [{ sceneTitle: ' 场景一 ', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: ['debt-1'] }, {}],
      [],
    ),
    [
      { sceneTitle: '场景一', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: ['debt-1'] },
      { sceneTitle: '场景 2', mustHappen: [], shouldAdvanceHooks: [], shouldResolveDebts: [] },
    ],
  )
})

test('buildActiveHookViews and hook action helpers keep hook routing semantics stable', () => {
  const views = __planningServiceTestables.buildActiveHookViews(
    {
      activeHookStates: [
        { hookId: 'hook-1', status: 'open' },
        { hookId: 'hook-2', status: 'payoff-planned' },
      ],
    } as unknown as PlanningContext,
    [
      {
        id: 'hook-1',
        title: '旧谜团',
        description: '旧谜团描述',
        payoffExpectation: '最终回收',
        priority: 'high',
        status: 'open',
      },
    ] as any,
  )

  assert.deepEqual(views, [
    {
      hookId: 'hook-1',
      title: '旧谜团',
      description: '旧谜团描述',
      payoffExpectation: '最终回收',
      priority: 'high',
      status: 'open',
    },
    {
      hookId: 'hook-2',
      title: 'hook-2',
      description: '',
      payoffExpectation: '',
      priority: 'medium',
      status: 'payoff-planned',
    },
  ])

  assert.equal(__planningServiceTestables.suggestHookAction('open'), 'foreshadow')
  assert.equal(__planningServiceTestables.suggestHookAction('foreshadowed'), 'advance')
  assert.equal(__planningServiceTestables.suggestHookAction('payoff-planned'), 'payoff')
  assert.equal(__planningServiceTestables.describeHookAction('advance'), '实质推进')
})

test('createRuleBasedPlan builds volume-aware fallback directives', () => {
  const context = {
    book: { id: 'book-1', title: '测试小说' },
    outline: { theme: '命运', coreConflicts: ['王城阴谋'] },
    chapter: {
      id: 'chapter-1',
      title: '暗潮',
      objective: '查明敌营动向',
      plannedBeats: ['潜入据点', '发现密信'],
    },
    volume: { id: 'volume-1', title: '第一卷', goal: '逼近真相' },
    previousChapter: { title: '前夜', summary: '上一章余波' },
    characterStates: [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }],
    characterArcs: [{ characterId: 'hero', arc: '成长', currentStage: '怀疑' }],
    importantItems: [{ id: 'map', name: '地图', quantity: 1, status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }],
    activeHookStates: [{ hookId: 'hook-1', status: 'open' }],
    hookPressures: [],
    narrativePressure: {
      highPressureHooks: [{ hookId: 'hook-1', pressureScore: 80, riskLevel: 'high' }],
      openNarrativeDebts: [{ debtType: 'promise', summary: '兑现旧约' }],
    },
    protectedFactConstraints: ['角色 hero 必须仍在 fortress'],
    memoryRecall: { recentEvents: ['密探失踪'], relevantLongTermEntries: [{ summary: '王城旧案' }] },
    volumePlan: { focusSummary: '围绕卷目标持续推进' },
    activeStoryThreads: [{ id: 'thread-1', title: '王城线', priority: 'high' }],
    currentChapterMission: { id: 'mission-1', summary: '推进王城线', successSignal: '至少推进一条卷级线程', missionType: 'advance' },
    endingReadiness: { closureGaps: [{ summary: '终局伏笔不足' }] },
    characterPresenceWindows: [],
    ensembleBalanceReport: {
      suggestedReturnCharacterIds: ['hero'],
      subplotCarryRequirements: [{ threadId: 'subplot-1' }],
    },
  } as unknown as PlanningContext

  const plan = __planningServiceTestables.createRuleBasedPlan(context, [
    {
      hookId: 'hook-1',
      title: '旧谜团',
      description: '旧谜团描述',
      payoffExpectation: '最终回收',
      priority: 'high',
      status: 'open',
    },
  ])

  assert.equal(plan.objective, '查明敌营动向')
  assert.equal(plan.windowRole, 'advance')
  assert.ok(plan.eventOutline.some((item) => item.includes('推进王城线')))
  assert.ok(plan.mustAdvanceHooks.includes('hook-1'))
  assert.ok(plan.mustResolveDebts.some((item) => item.includes('兑现旧约')))
  assert.ok(plan.mustPreserveFacts.includes('角色 hero 必须仍在 fortress'))
  assert.ok(plan.endingDrive.includes('hook-1'))
})

test('PlanningService planVolumeWindow, planVolumeWindowAsync and planChapter build rolling missions and persist fallback plan', async () => {
  const context = {
    book: { id: 'book-1', title: '测试小说' },
    outline: { theme: '命运', premise: '少年卷入阴谋', worldview: '高压世界', coreConflicts: ['王城阴谋'], endingVision: '逼近真相' },
    chapter: {
      id: 'chapter-1',
      title: '暗潮',
      objective: '查明敌营动向',
      index: 1,
      volumeId: 'volume-1',
      plannedBeats: ['潜入据点', '发现密信'],
    },
    volume: { id: 'volume-1', title: '第一卷', goal: '逼近真相', summary: '卷摘要' },
    previousChapter: { id: 'chapter-0', title: '前夜', summary: '上一章余波' },
    characterStates: [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }],
    characterArcs: [{ characterId: 'hero', arc: '成长', currentStage: '怀疑' }],
    importantItems: [{ id: 'map', name: '地图', quantity: 1, status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }],
    activeHookStates: [{ hookId: 'hook-1', status: 'open' }],
    hookPressures: [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }],
    narrativePressure: {
      highPressureHooks: [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }],
      openNarrativeDebts: [{ debtType: 'promise', summary: '兑现旧约' }],
    },
    protectedFactConstraints: ['角色 hero 必须仍在 fortress'],
    memoryRecall: {
      recentEvents: ['密探失踪'],
      relevantLongTermEntries: [{ summary: '王城旧案' }],
    },
    volumePlan: null,
    activeStoryThreads: [{ id: 'thread-1', title: '王城线', priority: 'high' }],
    currentChapterMission: null,
    endingReadiness: { closureGaps: [{ summary: '终局伏笔不足', relatedThreadId: 'thread-1' }] },
    characterPresenceWindows: [],
    ensembleBalanceReport: {
      suggestedReturnCharacterIds: ['hero'],
      subplotCarryRequirements: [{ threadId: 'subplot-1' }],
    },
  } as unknown as PlanningContext

  const createdPlans: unknown[] = []
  const updateCalls: Array<{ chapterId: string; versionId: string }> = []
  const chapters = [
    { id: 'chapter-1', volumeId: 'volume-1', index: 1, title: '暗潮' },
    { id: 'chapter-2', volumeId: 'volume-1', index: 2, title: '风暴前夜' },
    { id: 'chapter-3', volumeId: 'volume-1', index: 3, title: '裂缝' },
  ]

  const service = new PlanningService(
    {
      buildAsync: async () => context,
    } as never,
    {
      createAsync: async (plan: unknown) => {
        createdPlans.push(plan)
      },
    } as never,
    {
      listByBookId: () => chapters,
      listByBookIdAsync: async () => chapters,
      updateCurrentPlanVersionAsync: async (chapterId: string, versionId: string) => {
        updateCalls.push({ chapterId, versionId })
      },
    } as never,
    null,
    {
      listByBookIdAsync: async () => [
        {
          id: 'hook-1',
          title: '旧谜团',
          description: '旧谜团描述',
          payoffExpectation: '最终回收',
          priority: 'high',
          status: 'open',
        },
      ],
    } as never,
  )

  const syncWindow = service.planVolumeWindow(context)
  const asyncWindow = await service.planVolumeWindowAsync(context)
  const planned = await service.planChapter('chapter-1')

  assert.equal(syncWindow.chapterMissions.length, 3)
  assert.equal(syncWindow.chapterMissions[0]?.missionType, 'advance')
  assert.equal(syncWindow.chapterMissions[1]?.missionType, 'complicate')
  assert.equal(syncWindow.chapterMissions[2]?.missionType, 'payoff')
  assert.equal(asyncWindow.chapterMissions.length, 3)
  assert.equal(planned.chapterId, 'chapter-1')
  assert.equal(createdPlans.length, 1)
  assert.equal(updateCalls[0]?.chapterId, 'chapter-1')
  assert.equal(updateCalls[0]?.versionId, planned.versionId)
  assert.equal(planned.missionId?.length ? true : false, true)
  assert.ok(planned.mustAdvanceHooks.includes('hook-1'))
})

test('PlanningService planChapter uses llm output and normalizes structured fields', async () => {
  const context = {
    book: { id: 'book-1', title: '测试小说' },
    outline: { theme: '命运', premise: '少年卷入阴谋', worldview: '高压世界', coreConflicts: ['王城阴谋'], endingVision: '逼近真相' },
    chapter: {
      id: 'chapter-1',
      title: '暗潮',
      objective: '查明敌营动向',
      index: 1,
      volumeId: 'volume-1',
      plannedBeats: ['潜入据点', '发现密信'],
    },
    volume: { id: 'volume-1', title: '第一卷', goal: '逼近真相', summary: '卷摘要' },
    previousChapter: { id: 'chapter-0', title: '前夜', summary: '上一章余波' },
    characterStates: [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }],
    characterArcs: [{ characterId: 'hero', arc: '成长', currentStage: '怀疑' }],
    importantItems: [{ id: 'map', name: '地图', quantity: 1, status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }],
    activeHookStates: [{ hookId: 'hook-1', status: 'open' }],
    hookPressures: [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }],
    narrativePressure: {
      highPressureHooks: [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }],
      openNarrativeDebts: [{ debtType: 'promise', summary: '兑现旧约' }],
    },
    protectedFactConstraints: ['角色 hero 必须仍在 fortress'],
    memoryRecall: {
      recentEvents: ['密探失踪'],
      relevantLongTermEntries: [{ summary: '王城旧案' }],
    },
    volumePlan: null,
    activeStoryThreads: [{ id: 'thread-1', title: '王城线', priority: 'high' }],
    currentChapterMission: null,
    endingReadiness: { closureGaps: [{ summary: '终局伏笔不足', relatedThreadId: 'thread-1' }] },
    characterPresenceWindows: [],
    ensembleBalanceReport: {
      suggestedReturnCharacterIds: ['hero'],
      subplotCarryRequirements: [{ threadId: 'subplot-1' }],
    },
  } as unknown as PlanningContext

  const createdPlans: any[] = []
  const service = new PlanningService(
    {
      buildAsync: async () => context,
    } as never,
    {
      createAsync: async (plan: any) => {
        createdPlans.push(plan)
      },
    } as never,
    {
      listByBookId: () => [{ id: 'chapter-1', volumeId: 'volume-1', index: 1, title: '暗潮' }],
      listByBookIdAsync: async () => [{ id: 'chapter-1', volumeId: 'volume-1', index: 1, title: '暗潮' }],
      updateCurrentPlanVersionAsync: async () => undefined,
    } as never,
    {
      generateText: async () => ({
        text: JSON.stringify({
          objective: 'LLM 章节目标',
          sceneCards: [
            {
              title: ' LLM 场景 ',
              purpose: ' 推进冲突 ',
              beats: ['事件A'],
              characterIds: ['hero'],
              items: ['map'],
              location: 'fortress',
            },
          ],
          sceneGoals: [{ sceneTitle: ' LLM 场景 ', conflict: ' 冲突 ', informationReveal: ' 线索 ', emotionalShift: ' 紧张 ' }],
          sceneConstraints: [{ sceneTitle: ' LLM 场景 ', mustInclude: ['潜入'], protectedFacts: ['角色 hero 必须仍在 fortress'] }],
          sceneEmotionalTargets: [{ sceneTitle: ' LLM 场景 ', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'high' }],
          sceneOutcomeChecklist: [{ sceneTitle: ' LLM 场景 ', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'] }],
          requiredCharacterIds: ['hero'],
          requiredLocationIds: ['fortress'],
          requiredItemIds: ['map'],
          eventOutline: ['事件A'],
          hookPlan: [{ hookId: 'hook-1', action: 'payoff', note: ' 回收旧谜团 ' }],
          statePredictions: { characters: [{ characterId: 'hero', change: '获得线索' }] },
          memoryCandidates: [{ content: '记忆候选' }],
          highPressureHookIds: ['hook-1'],
          characterArcTargets: ['hero:成长:怀疑'],
          debtCarryTargets: ['promise：兑现旧约'],
          endingDrive: ' 章末制造强牵引 ',
          mustResolveDebts: ['promise：兑现旧约'],
          mustAdvanceHooks: ['hook-1'],
          mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
        }),
        metadata: {
          selectedProvider: 'openai',
          providerSource: 'default-provider',
          selectedModel: 'gpt-openai',
          modelSource: 'provider-default',
          fallbackUsed: false,
        },
      }),
    } as never,
    {
      listByBookIdAsync: async () => [
        {
          id: 'hook-1',
          title: '旧谜团',
          description: '旧谜团描述',
          payoffExpectation: '最终回收',
          priority: 'high',
          status: 'open',
        },
      ],
    } as never,
  )

  const plan = await service.planChapter('chapter-1')

  assert.equal(createdPlans.length, 1)
  assert.equal(plan.objective, 'LLM 章节目标')
  assert.equal(plan.sceneCards[0]?.title, 'LLM 场景')
  assert.equal(plan.sceneCards[0]?.locationId, 'fortress')
  assert.equal(plan.sceneGoals[0]?.conflict, '冲突')
  assert.equal(plan.hookPlan[0]?.action, 'payoff')
  assert.equal(plan.statePredictions[0], 'hero：获得线索')
  assert.equal(plan.memoryCandidates[0], '记忆候选')
  assert.equal(plan.endingDrive, '章末制造强牵引')
  assert.equal(plan.llmMetadata?.selectedModel, 'gpt-openai')
})