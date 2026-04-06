import assert from 'node:assert/strict'
import test from 'node:test'

import type { ClosureSuggestions, ReviewReport, WordCountCheck } from '../../../../src/shared/types/domain.js'
import { ReviewService, __reviewServiceTestables } from '../../../../src/core/review/service.js'

const baseClosureSuggestions = (): ClosureSuggestions => ({
  characters: [],
  items: [],
  hooks: [],
  memory: [],
})

const baseWordCountCheck = (): WordCountCheck => ({
  target: 2000,
  actual: 2000,
  toleranceRatio: 0.2,
  deviationRatio: 0,
  passed: true,
})

test('createWordCountCheck calculates deviation ratio and pass status', () => {
  const passed = __reviewServiceTestables.createWordCountCheck(2000, 2200, 0.2)
  const failed = __reviewServiceTestables.createWordCountCheck(2000, 2600, 0.2)

  assert.equal(passed.deviationRatio, 0.1)
  assert.equal(passed.passed, true)
  assert.equal(failed.deviationRatio, 0.3)
  assert.equal(failed.passed, false)
})

test('evaluateMissionProgress distinguishes completed, partial and not-applicable missions', () => {
  const completed = __reviewServiceTestables.evaluateMissionProgress(
    {
      missionId: 'mission-1',
      threadFocus: ['thread-A'],
      eventOutline: ['事件推进'],
      carryInTasks: ['承接前情'],
      carryOutTasks: ['抛出后续'],
    },
    '正文承接 thread-A，并完成事件推进，还抛出后续。',
  )
  const partial = __reviewServiceTestables.evaluateMissionProgress(
    {
      missionId: 'mission-2',
      threadFocus: ['thread-B'],
      eventOutline: ['事件B'],
      carryInTasks: ['承接B'],
      carryOutTasks: ['后续B'],
    },
    '正文只出现了 thread-B。',
  )
  const notApplicable = __reviewServiceTestables.evaluateMissionProgress(
    {
      threadFocus: ['thread-C'],
      eventOutline: ['事件C'],
      carryInTasks: [],
      carryOutTasks: [],
    },
    '任意正文',
  )

  assert.equal(completed.status, 'completed')
  assert.deepEqual(completed.evidence, ['thread-A', '事件推进', '抛出后续'])
  assert.equal(partial.status, 'partial')
  assert.deepEqual(partial.evidence, ['thread-B'])
  assert.equal(notApplicable.status, 'not-applicable')
  assert.deepEqual(notApplicable.evidence, [])
})

test('mergeMissionIssues creates clear warnings for partial and missing mission progress', () => {
  const partial = __reviewServiceTestables.mergeMissionIssues(
    { missionId: 'mission-1', carryInTasks: ['承接前情'], carryOutTasks: ['抛出后续'] },
    { missionId: 'mission-1', missionSummary: '承接前情', status: 'partial', evidence: ['thread-A'] },
  )
  const missing = __reviewServiceTestables.mergeMissionIssues(
    { missionId: 'mission-2', carryInTasks: [], carryOutTasks: ['收束线索'] },
    { missionId: 'mission-2', missionSummary: '收束线索', status: 'missing', evidence: [] },
  )

  assert.deepEqual(partial, ['卷级 mission 承接不足：承接前情'])
  assert.deepEqual(missing, ['卷级 mission 未得到有效推进：收束线索'])
})

test('review merge helpers detect hook, item and memory continuity issues', () => {
  const hookIssues = __reviewServiceTestables.mergeHookIssues(
    [],
    [{ hookId: 'hook-1', status: 'open' }],
    [{ hookId: 'hook-1', action: 'advance', note: '推进 hook-1' }],
    '## 钩子约束\nHook（hook-1） 动作=hold；说明=推进 hook-1',
  )
  assert.ok(hookIssues.some((item: string) => item.includes('草稿动作与计划不一致')))

  const itemIssues = __reviewServiceTestables.mergeItemIssues(
    [],
    [{
      id: 'item-1',
      bookId: 'book-1',
      itemId: 'item-1',
      name: '密信',
      unit: '封',
      type: 'document',
      description: '关键线索',
      isUniqueWorldwide: true,
      isImportant: true,
      quantity: 1,
      status: '完整',
      ownerCharacterId: 'hero',
      locationId: 'fortress',
      updatedAt: '2026-04-06T00:00:00.000Z',
    }],
    '密信（item-1） 数量=2；状态=损坏；持有者=ally；地点=tower',
    ['item-1'],
  )
  assert.ok(itemIssues.some((item: string) => item.includes('数量与当前状态冲突')))
  assert.ok(itemIssues.some((item: string) => item.includes('状态与当前状态冲突')))
  assert.ok(itemIssues.some((item: string) => item.includes('持有者与当前状态冲突')))
  assert.ok(itemIssues.some((item: string) => item.includes('地点与当前状态冲突')))

  const memoryIssues = __reviewServiceTestables.mergeMemoryIssues(
    [],
    [{ summary: '王城旧案', importance: 5 }],
    '## 记忆约束\n正文并非王城旧案',
  )
  assert.ok(memoryIssues.some((item: string) => item.includes('长期记忆冲突')))
})

test('review helper groups detect thread, ending, ensemble, debt and scene execution gaps', () => {
  assert.deepEqual(
    __reviewServiceTestables.mergeThreadFocusIssues(['thread-1'], '正文没有任何相关标识'),
    ['高优先级线程 thread-1 本章未形成明确承接。'],
  )

  assert.deepEqual(
    __reviewServiceTestables.mergePressureHookIssues([{ hookId: 'hook-1', pressureScore: 90, riskLevel: 'high' }], [], '正文未提及'),
    ['高压力 Hook hook-1 本章未得到明确推进。'],
  )

  const endingIssues = __reviewServiceTestables.mergeEndingReadinessIssues(
    { subplotCarryThreadIds: ['subplot-1'], carryOutTasks: ['后续推进'], endingDrive: '章末抛出新悬念' },
    '正文没有相关承接',
  )
  assert.ok(endingIssues.some((item: string) => item.includes('关键支线 subplot-1')))
  assert.ok(endingIssues.some((item: string) => item.includes('章末未体现结局前置牵引')))
  assert.ok(endingIssues.some((item: string) => item.includes('后续收束承接口')))

  assert.deepEqual(
    __reviewServiceTestables.mergeEnsembleBalanceIssues(['hero'], ['subplot-1'], '正文没有相关名字'),
    ['群像平衡不足：角色 hero 本章未得到重新承接。', '支线承接不足：线程 subplot-1 本章未得到重新挂接。'],
  )

  assert.deepEqual(
    __reviewServiceTestables.mergeDebtCarryIssues(['promise：兑现旧约'], [], '正文没有兑现旧约'),
    ['未完成叙事债务未被承接：promise：兑现旧约'],
  )

  assert.deepEqual(
    __reviewServiceTestables.mergeDebtCarryIssues(['promise：兑现旧约'], [], '正文里主角终于兑现旧约，并为旧案付出代价。'),
    [],
  )

  const sceneIssues = __reviewServiceTestables.mergeSceneExecutionIssues(
    [{ sceneTitle: '场景一', conflict: '潜入敌营', informationReveal: '发现异常', emotionalShift: '紧张升级' }],
    [{ sceneTitle: '场景一', mustHappen: ['进入据点'] }],
    '正文没有任何对应描写',
  )
  assert.ok(sceneIssues.some((item: string) => item.includes('场景任务 场景一 在正文中落地不足')))
  assert.ok(sceneIssues.some((item: string) => item.includes('场景 场景一 缺少结果兑现')))

  assert.deepEqual(
    __reviewServiceTestables.mergeEndingDriveIssues('章末抛出新悬念', '正文没有任何对应片段'),
    ['章节结尾牵引不足，未明显兑现计划中的结尾驱动：章末抛出新悬念'],
  )

  assert.deepEqual(
    __reviewServiceTestables.mergeEmotionalProgressionIssues(
      [{ sceneTitle: '场景一', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'high' }],
      '正文只体现谨慎，没有目标情绪',
    ),
    ['场景 场景一 的情绪推进不足：谨慎 -> 紧张 (high)'],
  )
})

test('review risk helpers build protected fact hints and approval risk levels', () => {
  assert.equal(__reviewServiceTestables.deriveApprovalRisk('needs-rewrite', [], [], [], [], []), 'high')
  assert.equal(__reviewServiceTestables.deriveApprovalRisk('warning', [], [], [], [], []), 'medium')
  assert.equal(__reviewServiceTestables.deriveApprovalRisk('pass', [], [], [], [], []), 'low')
  assert.equal(__reviewServiceTestables.deriveApprovalRisk('pass', ['a', 'b', 'c'], [], [], [], []), 'high')

  const hints = __reviewServiceTestables.buildProtectedFactHints(
    [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }],
    [{
      id: 'item-1',
      bookId: 'book-1',
      itemId: 'item-1',
      name: '密信',
      unit: '封',
      type: 'document',
      description: '关键线索',
      isUniqueWorldwide: true,
      isImportant: true,
      quantity: 1,
      status: '完整',
      ownerCharacterId: 'hero',
      locationId: 'fortress',
      updatedAt: '2026-04-06T00:00:00.000Z',
    }],
    [{ summary: '王城旧案', importance: 5 }],
    [{ hookId: 'hook-1', status: 'open' }],
  )
  assert.ok(hints.some((item: string) => item.includes('角色 hero')))
  assert.ok(hints.some((item: string) => item.includes('物品 item-1')))
  assert.ok(hints.some((item: string) => item.includes('Hook hook-1')))
  assert.ok(hints.some((item: string) => item.includes('长期事实：王城旧案')))
})

test('normalizeClosureSuggestions filters invalid entities and fills default semantic fields', () => {
  const normalized = __reviewServiceTestables.normalizeClosureSuggestions(
    {
      characters: [
        {
          characterId: ' hero-1 ',
          nextLocationId: ' tower ',
          nextStatusNotes: ['觉醒', '  '],
          reason: '状态变化',
          evidence: ['证据一'],
        },
        {
          characterId: '   ',
        },
      ],
      items: [
        {
          itemId: 'item-1',
          nextQuantity: 2,
          nextStatus: '已激活',
          reason: '物品被使用',
          evidence: ['证据二'],
        },
      ],
      hooks: [
        {
          hookId: 'hook-1',
          nextStatus: 'invalid-status',
          actualOutcome: 'advance',
          reason: '推进 hook',
          evidence: ['证据三'],
        },
      ],
      memory: [
        {
          summary: ' 新事实 ',
          memoryScope: 'invalid-scope',
          reason: '记忆沉淀',
          evidence: ['证据四'],
        },
      ],
    },
    'llm',
  )

  assert.equal(normalized.characters.length, 1)
  assert.deepEqual(normalized.characters[0], {
    characterId: 'hero-1',
    nextLocationId: 'tower',
    nextStatusNotes: ['觉醒'],
    reason: '状态变化',
    evidence: ['证据一'],
    source: 'llm',
  })
  assert.equal(normalized.items[0]?.nextQuantity, 2)
  assert.equal(normalized.hooks[0]?.nextStatus, 'open')
  assert.equal(normalized.memory[0]?.memoryScope, 'observation')
})

test('buildReviewLayers derives rewrite strategy from hard issues and mission signals', () => {
  const consistencyFirst = __reviewServiceTestables.buildReviewLayers({
    wordCountCheck: baseWordCountCheck(),
    consistencyIssues: ['设定冲突'],
    characterIssues: [],
    itemIssues: [],
    memoryIssues: [],
    pacingIssues: ['情绪推进不足'],
    hookIssues: ['结尾牵引不足'],
    threadIssues: [],
    endingReadinessIssues: [],
    missionProgress: { status: 'completed', evidence: ['thread-A'], missionId: 'mission-1', missionSummary: '推进主线' },
    revisionAdvice: ['需要补一段对话润色'],
  })

  const threadFocus = __reviewServiceTestables.buildReviewLayers({
    wordCountCheck: baseWordCountCheck(),
    consistencyIssues: [],
    characterIssues: [],
    itemIssues: [],
    memoryIssues: [],
    pacingIssues: [],
    hookIssues: [],
    threadIssues: ['高优先级线程 thread-B 本章未形成明确承接。'],
    endingReadinessIssues: [],
    missionProgress: { status: 'missing', evidence: [], missionId: 'mission-2', missionSummary: '推进支线' },
    revisionAdvice: [],
  })

  assert.equal(consistencyFirst.rewriteStrategySuggestion.primary, 'consistency-first')
  assert.ok(consistencyFirst.narrativeQuality.some((item) => item.category === 'ending-drive'))
  assert.ok(consistencyFirst.languageQuality.some((item) => item.category === 'style'))

  assert.equal(threadFocus.rewriteStrategySuggestion.primary, 'thread-focus')
  assert.match(threadFocus.rewriteStrategySuggestion.rationale.join(' '), /mission|线程/)
})

test('ReviewService reviewChapter rejects missing prerequisites', async () => {
  const baseDeps = {
    bookRepository: { getFirstAsync: async () => ({ id: 'book-1', defaultChapterWordCount: 2000, chapterWordCountToleranceRatio: 0.2 }) },
    chapterRepository: { getByIdAsync: async () => ({ id: 'chapter-1', objective: '查明真相', currentVersionId: 'draft-version-1', currentPlanVersionId: 'plan-version-1' }) },
    chapterPlanRepository: { getByVersionIdAsync: async () => ({ id: 'plan-1', sceneCards: [], sceneGoals: [], sceneConstraints: [], sceneEmotionalTargets: [], sceneOutcomeChecklist: [], eventOutline: [], statePredictions: [], hookPlan: [], endingDrive: '', requiredCharacterIds: [], requiredLocationIds: [], requiredItemIds: [], highPressureHookIds: [], threadFocus: [], carryInTasks: [], carryOutTasks: [], ensembleFocusCharacterIds: [], subplotCarryThreadIds: [], debtCarryTargets: [], characterArcTargets: [], memoryCandidates: [], mustResolveDebts: [], mustAdvanceHooks: [], mustPreserveFacts: [] }) },
    chapterDraftRepository: { getLatestByChapterIdAsync: async () => ({ id: 'draft-1', actualWordCount: 1500, content: '正文' }) },
    chapterReviewRepository: { createAsync: async () => undefined },
    characterCurrentStateRepository: { listByBookIdAsync: async () => [] },
    characterArcRepository: { listByBookIdAsync: async () => [] },
    itemCurrentStateRepository: { listImportantByBookIdAsync: async () => [] },
    memoryRepository: { getLongTermByBookIdAsync: async () => null },
    hookRepository: { listByBookIdAsync: async () => [] },
    hookStateRepository: { listActiveByBookIdAsync: async () => [] },
    hookPressureRepository: { listActiveByBookIdAsync: async () => [] },
    narrativeDebtRepository: { listOpenByBookIdAsync: async () => [] },
  }

  const missingBookService = new ReviewService(
    { getFirstAsync: async () => null } as never,
    baseDeps.chapterRepository as never,
    baseDeps.chapterPlanRepository as never,
    baseDeps.chapterDraftRepository as never,
    baseDeps.chapterReviewRepository as never,
    baseDeps.characterCurrentStateRepository as never,
    baseDeps.characterArcRepository as never,
    baseDeps.itemCurrentStateRepository as never,
    baseDeps.memoryRepository as never,
    baseDeps.hookRepository as never,
    baseDeps.hookStateRepository as never,
    baseDeps.hookPressureRepository as never,
    baseDeps.narrativeDebtRepository as never,
    null,
  )
  await assert.rejects(() => missingBookService.reviewChapter('chapter-1'), /Project is not initialized/)

  const missingDraftChainService = new ReviewService(
    baseDeps.bookRepository as never,
    { getByIdAsync: async () => ({ id: 'chapter-1', objective: '查明真相', currentVersionId: null, currentPlanVersionId: 'plan-version-1' }) } as never,
    baseDeps.chapterPlanRepository as never,
    baseDeps.chapterDraftRepository as never,
    baseDeps.chapterReviewRepository as never,
    baseDeps.characterCurrentStateRepository as never,
    baseDeps.characterArcRepository as never,
    baseDeps.itemCurrentStateRepository as never,
    baseDeps.memoryRepository as never,
    baseDeps.hookRepository as never,
    baseDeps.hookStateRepository as never,
    baseDeps.hookPressureRepository as never,
    baseDeps.narrativeDebtRepository as never,
    null,
  )
  await assert.rejects(() => missingDraftChainService.reviewChapter('chapter-1'), /Current draft chain is missing/)

  const missingPlanService = new ReviewService(
    baseDeps.bookRepository as never,
    { getByIdAsync: async () => ({ id: 'chapter-1', objective: '查明真相', currentVersionId: 'draft-version-1', currentPlanVersionId: null }) } as never,
    baseDeps.chapterPlanRepository as never,
    baseDeps.chapterDraftRepository as never,
    baseDeps.chapterReviewRepository as never,
    baseDeps.characterCurrentStateRepository as never,
    baseDeps.characterArcRepository as never,
    baseDeps.itemCurrentStateRepository as never,
    baseDeps.memoryRepository as never,
    baseDeps.hookRepository as never,
    baseDeps.hookStateRepository as never,
    baseDeps.hookPressureRepository as never,
    baseDeps.narrativeDebtRepository as never,
    null,
  )
  await assert.rejects(() => missingPlanService.reviewChapter('chapter-1'), /Current chapter plan is missing for review/)
})

test('ReviewService reviewChapter builds and persists rule-based review when llm is unavailable', async () => {
  const createdReviews: ReviewReport[] = []
  const marked: string[] = []

  const service = new ReviewService(
    {
      getFirstAsync: async () => ({
        id: 'book-1',
        defaultChapterWordCount: 2000,
        chapterWordCountToleranceRatio: 0.2,
      }),
    } as never,
    {
      getByIdAsync: async () => ({
        id: 'chapter-1',
        title: '暗潮',
        objective: '查明真相',
        currentVersionId: 'draft-version-1',
        currentPlanVersionId: 'plan-version-1',
      }),
      markReviewedAsync: async (chapterId: string) => {
        marked.push(chapterId)
      },
    } as never,
    {
      getByVersionIdAsync: async () => ({
        id: 'plan-1',
        sceneCards: [{ title: '开场铺垫', purpose: '建立冲突', beats: ['潜入'], characterIds: ['hero'], factionIds: [], itemIds: [] }],
        sceneGoals: [{ sceneTitle: '开场铺垫', conflict: '潜入敌营', informationReveal: '发现异常', emotionalShift: '从谨慎到紧张' }],
        sceneConstraints: [{ sceneTitle: '开场铺垫', mustInclude: ['潜入'], mustAvoid: [], protectedFacts: [] }],
        sceneEmotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' }],
        sceneOutcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
        eventOutline: ['推进 thread-1', '形成后续'],
        statePredictions: ['hero：获得线索'],
        hookPlan: [{ hookId: 'hook-1', action: 'advance', note: '推进 hook-1' }],
        endingDrive: '章末抛出新悬念',
        requiredCharacterIds: ['hero'],
        requiredLocationIds: ['fortress'],
        requiredItemIds: ['item-1'],
        highPressureHookIds: ['hook-1'],
        threadFocus: ['thread-1'],
        carryInTasks: ['承接前情'],
        carryOutTasks: ['后续推进'],
        ensembleFocusCharacterIds: ['hero'],
        subplotCarryThreadIds: ['subplot-1'],
        debtCarryTargets: ['promise：兑现旧约'],
        characterArcTargets: ['hero:成长:怀疑'],
        memoryCandidates: ['敌营异动'],
        mustResolveDebts: ['promise：兑现旧约'],
        mustAdvanceHooks: ['hook-1'],
        mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
      }),
    } as never,
    {
      getLatestByChapterIdAsync: async () => ({
        id: 'draft-1',
        actualWordCount: 1500,
        content: [
          'thread-1 与 承接前情 已进入正文。',
          '## 角色当前状态',
          '角色（hero） 当前位置=fortress；状态=警惕',
          '## 钩子约束',
          'Hook（hook-1） 动作=advance；说明=推进 hook-1',
          '## 记忆约束',
          '敌营异动',
        ].join('\n'),
      }),
    } as never,
    {
      createAsync: async (review: ReviewReport) => {
        createdReviews.push(review)
      },
    } as never,
    { listByBookIdAsync: async () => [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }] } as never,
    { listByBookIdAsync: async () => [{ characterId: 'hero', arc: '成长', currentStage: '怀疑' }] } as never,
    { listImportantByBookIdAsync: async () => [{ id: 'item-1', name: '密信', quantity: 1, status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }] } as never,
    { getLongTermByBookIdAsync: async () => ({ entries: [{ summary: '敌营异动', importance: 5 }] }) } as never,
    { listByBookIdAsync: async () => [{ id: 'hook-1', title: '旧谜团', description: '敌营异动', payoffExpectation: '最终回收' }] } as never,
    { listActiveByBookIdAsync: async () => [{ hookId: 'hook-1', status: 'open' }] } as never,
    { listActiveByBookIdAsync: async () => [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }] } as never,
    { listOpenByBookIdAsync: async () => [{ summary: '兑现旧约' }] } as never,
    null,
  )

  const review = await service.reviewChapter('chapter-1')

  assert.equal(review.bookId, 'book-1')
  assert.equal(review.chapterId, 'chapter-1')
  assert.equal(createdReviews.length, 1)
  assert.equal(marked[0], 'chapter-1')
  assert.equal(review.reviewLayers.rewriteStrategySuggestion.primary.length > 0, true)
  assert.equal(review.wordCountCheck.passed, false)
})

test('ReviewService reviewChapter uses llm review result and preserves llm metadata', async () => {
  const createdReviews: ReviewReport[] = []
  const marked: string[] = []

  const service = new ReviewService(
    {
      getFirstAsync: async () => ({
        id: 'book-1',
        defaultChapterWordCount: 2000,
        chapterWordCountToleranceRatio: 0.2,
      }),
    } as never,
    {
      getByIdAsync: async () => ({
        id: 'chapter-1',
        title: '暗潮',
        objective: '查明真相',
        currentVersionId: 'draft-version-1',
        currentPlanVersionId: 'plan-version-1',
      }),
      markReviewedAsync: async (chapterId: string) => {
        marked.push(chapterId)
      },
    } as never,
    {
      getByVersionIdAsync: async () => ({
        id: 'plan-1',
        sceneCards: [{ title: '开场铺垫', purpose: '建立冲突', beats: ['潜入'], characterIds: ['hero'], factionIds: [], itemIds: [] }],
        sceneGoals: [{ sceneTitle: '开场铺垫', conflict: '潜入敌营', informationReveal: '发现异常', emotionalShift: '从谨慎到紧张' }],
        sceneConstraints: [{ sceneTitle: '开场铺垫', mustInclude: ['潜入'], mustAvoid: [], protectedFacts: [] }],
        sceneEmotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' }],
        sceneOutcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
        eventOutline: ['推进 thread-1', '形成后续'],
        statePredictions: ['hero：获得线索'],
        hookPlan: [{ hookId: 'hook-1', action: 'advance', note: '推进 hook-1' }],
        endingDrive: '章末抛出新悬念',
        requiredCharacterIds: ['hero'],
        requiredLocationIds: ['fortress'],
        requiredItemIds: ['item-1'],
        highPressureHookIds: ['hook-1'],
        threadFocus: ['thread-1'],
        carryInTasks: ['承接前情'],
        carryOutTasks: ['后续推进'],
        ensembleFocusCharacterIds: ['hero'],
        subplotCarryThreadIds: ['subplot-1'],
        debtCarryTargets: ['promise：兑现旧约'],
        characterArcTargets: ['hero:成长:怀疑'],
        memoryCandidates: ['敌营异动'],
        mustResolveDebts: ['promise：兑现旧约'],
        mustAdvanceHooks: ['hook-1'],
        mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
      }),
    } as never,
    {
      getLatestByChapterIdAsync: async () => ({
        id: 'draft-1',
        actualWordCount: 1900,
        content: [
          'thread-1 与 承接前情 已进入正文。',
          '## 角色当前状态',
          '角色（hero） 当前位置=fortress；状态=警惕',
          '## 钩子约束',
          'Hook（hook-1） 动作=advance；说明=推进 hook-1',
          '## 记忆约束',
          '敌营异动',
        ].join('\n'),
      }),
    } as never,
    {
      createAsync: async (review: ReviewReport) => {
        createdReviews.push(review)
      },
    } as never,
    { listByBookIdAsync: async () => [{ characterId: 'hero', currentLocationId: 'fortress', statusNotes: ['警惕'] }] } as never,
    { listByBookIdAsync: async () => [{ characterId: 'hero', arc: '成长', currentStage: '怀疑' }] } as never,
    { listImportantByBookIdAsync: async () => [{ id: 'item-1', name: '密信', quantity: 1, status: '完整', ownerCharacterId: 'hero', locationId: 'fortress' }] } as never,
    { getLongTermByBookIdAsync: async () => ({ entries: [{ summary: '敌营异动', importance: 5 }] }) } as never,
    { listByBookIdAsync: async () => [{ id: 'hook-1', title: '旧谜团', description: '敌营异动', payoffExpectation: '最终回收' }] } as never,
    { listActiveByBookIdAsync: async () => [{ hookId: 'hook-1', status: 'open' }] } as never,
    { listActiveByBookIdAsync: async () => [{ hookId: 'hook-1', pressureScore: 85, riskLevel: 'high' }] } as never,
    { listOpenByBookIdAsync: async () => [{ summary: '兑现旧约' }] } as never,
    {
      generateText: async () => ({
        text: JSON.stringify({
          decision: 'warning',
          consistencyIssues: ['LLM 一致性问题'],
          characterIssues: [{ summary: 'LLM 角色问题' }],
          itemIssues: [],
          memoryIssues: [],
          pacingIssues: ['LLM 节奏问题'],
          hookIssues: ['LLM Hook 问题'],
          newFactCandidates: [{ fact: '新的结构事实' }],
          closureSuggestions: {
            memory: [{ summary: '记忆事实', memoryScope: 'short-term', reason: 'LLM 归纳', evidence: ['证据'] }],
          },
          revisionAdvice: [{ action: '补强结尾牵引' }],
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
  )

  const review = await service.reviewChapter('chapter-1')

  assert.equal(createdReviews.length, 1)
  assert.equal(marked[0], 'chapter-1')
  assert.equal(review.llmMetadata?.selectedProvider, 'openai')
  assert.ok(review.consistencyIssues.includes('LLM 一致性问题'))
  assert.ok(review.characterIssues.some((item) => item.includes('LLM 角色问题')))
  assert.ok(review.revisionAdvice.some((item) => item.includes('补强结尾牵引')))
  assert.ok(review.newFactCandidates.includes('新的结构事实'))
})
