import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlanningContext } from '../../../../src/shared/types/domain.js'
import { __planningServiceTestables } from '../../../../src/core/planning/service.js'

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