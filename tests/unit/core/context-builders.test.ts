import assert from 'node:assert/strict'
import test from 'node:test'

import { PlanningContextBuilder } from '../../../src/core/context/planning-context-builder.js'
import { WritingContextBuilder } from '../../../src/core/context/writing-context-builder.js'
import { NovelError } from '../../../src/shared/utils/errors.js'
import {
  createBookFixture,
  createChapterFixture,
  createChapterPlanFixture,
  createEndingReadinessFixture,
  createOutlineFixture,
  createStoryThreadFixture,
  createVolumeFixture,
  createVolumePlanFixture,
} from '../../helpers/domain-fixtures.js'

function createPlanningBuilder(options?: {
  book?: unknown
  outline?: unknown
  chapter?: unknown
  volume?: unknown
  volumePlan?: unknown
  previousChapter?: unknown
  chapters?: unknown[]
  characterStates?: unknown[]
  characterArcs?: unknown[]
  importantItems?: unknown[]
  shortTermMemory?: unknown
  observationMemory?: unknown
  protectedFacts?: Array<{ summary: string; importance: number }>
  recalledEntries?: Array<{ summary: string; importance: number }>
  activeHookStates?: unknown[]
  hookPressures?: unknown[]
  activeStoryThreads?: unknown[]
  endingReadiness?: unknown
  openNarrativeDebts?: unknown[]
}) {
  const has = <K extends keyof NonNullable<typeof options>>(key: K): boolean =>
    Boolean(options) && Object.prototype.hasOwnProperty.call(options, key)

  const book = has('book') ? options?.book : createBookFixture({ styleGuide: ['冷峻', '紧张'] })
  const chapter = has('chapter') ? options?.chapter : createChapterFixture({ id: 'chapter-3', index: 3, volumeId: 'volume-1' })
  const volume = has('volume') ? options?.volume : createVolumeFixture({ id: 'volume-1', chapterIds: ['chapter-1', 'chapter-2', 'chapter-3'] })

  const deps = {
    bookRepository: {
      getFirst: () => book,
      getFirstAsync: async () => book,
    },
    outlineRepository: {
      getByBookId: () => (has('outline') ? options?.outline : createOutlineFixture()),
      getByBookIdAsync: async () => (has('outline') ? options?.outline : createOutlineFixture()),
    },
    chapterRepository: {
      getById: () => chapter,
      getByIdAsync: async () => chapter,
      getPreviousChapter: () => options?.previousChapter ?? createChapterFixture({ id: 'chapter-2', index: 2, title: '前章' }),
      getPreviousChapterAsync: async () => options?.previousChapter ?? createChapterFixture({ id: 'chapter-2', index: 2, title: '前章' }),
      listByBookId: () =>
        options?.chapters ?? [
          createChapterFixture({ id: 'chapter-1', index: 1, title: '开场' }),
          createChapterFixture({ id: 'chapter-2', index: 2, title: '潜入' }),
          chapter,
        ],
      listByBookIdAsync: async () =>
        options?.chapters ?? [
          createChapterFixture({ id: 'chapter-1', index: 1, title: '开场' }),
          createChapterFixture({ id: 'chapter-2', index: 2, title: '潜入' }),
          chapter,
        ],
    },
    volumeRepository: {
      getById: () => volume,
      getByIdAsync: async () => volume,
    },
    volumePlanRepository: {
      getLatestByVolumeId: () => options?.volumePlan ?? createVolumePlanFixture({ volumeId: 'volume-1', chapterMissions: [] }),
      getLatestByVolumeIdAsync: async () => options?.volumePlan ?? createVolumePlanFixture({ volumeId: 'volume-1', chapterMissions: [] }),
    },
    storyThreadRepository: {
      listActiveByBookId: () =>
        options?.activeStoryThreads ?? [
          createStoryThreadFixture({ id: 'thread-1', linkedCharacterIds: ['hero'], priority: 'critical' }),
          createStoryThreadFixture({ id: 'thread-2', linkedCharacterIds: [], priority: 'high' }),
        ],
      listActiveByBookIdAsync: async () =>
        options?.activeStoryThreads ?? [
          createStoryThreadFixture({ id: 'thread-1', linkedCharacterIds: ['hero'], priority: 'critical' }),
          createStoryThreadFixture({ id: 'thread-2', linkedCharacterIds: [], priority: 'high' }),
        ],
    },
    endingReadinessRepository: {
      getByBookId: () => options?.endingReadiness ?? createEndingReadinessFixture(),
      getByBookIdAsync: async () => options?.endingReadiness ?? createEndingReadinessFixture(),
    },
    characterCurrentStateRepository: {
      listByBookId: () => options?.characterStates ?? [{ characterId: 'hero' }, { characterId: 'ally' }],
      listByBookIdAsync: async () => options?.characterStates ?? [{ characterId: 'hero' }, { characterId: 'ally' }],
    },
    characterArcRepository: {
      listByBookId: () => options?.characterArcs ?? [{ characterId: 'hero', arc: '成长', currentStage: 'rising', summary: '开始动摇', updatedAt: '2026-04-06T00:00:00.000Z' }],
      listByBookIdAsync: async () => options?.characterArcs ?? [{ characterId: 'hero', arc: '成长', currentStage: 'rising', summary: '开始动摇', updatedAt: '2026-04-06T00:00:00.000Z' }],
    },
    itemCurrentStateRepository: {
      listImportantByBookId: () => options?.importantItems ?? [{ id: 'item-1', itemId: 'item-1', name: '密信', status: '已取得' }],
      listImportantByBookIdAsync: async () => options?.importantItems ?? [{ id: 'item-1', itemId: 'item-1', name: '密信', status: '已取得' }],
    },
    memoryRepository: {
      getShortTermByBookId: () => options?.shortTermMemory ?? { bookId: 'book-1', chapterId: 'chapter-2', summaries: ['前情'], recentEvents: ['潜入'], updatedAt: '2026-04-06T00:00:00.000Z' },
      getShortTermByBookIdAsync: async () => options?.shortTermMemory ?? { bookId: 'book-1', chapterId: 'chapter-2', summaries: ['前情'], recentEvents: ['潜入'], updatedAt: '2026-04-06T00:00:00.000Z' },
      getObservationByBookId: () => options?.observationMemory ?? { bookId: 'book-1', chapterId: 'chapter-2', entries: [{ summary: '守卫增多' }], updatedAt: '2026-04-06T00:00:00.000Z' },
      getObservationByBookIdAsync: async () => options?.observationMemory ?? { bookId: 'book-1', chapterId: 'chapter-2', entries: [{ summary: '守卫增多' }], updatedAt: '2026-04-06T00:00:00.000Z' },
      recallRelevantLongTermEntries: (_bookId: string, queryTerms: string[]) =>
        queryTerms.length === 3
          ? (options?.protectedFacts ?? [
              { summary: 'hero 必须继续隐藏身份', importance: 80 },
              { summary: '低优先记忆', importance: 40 },
            ])
          : (options?.recalledEntries ?? [{ summary: '王城阴谋正在升级', importance: 90 }]),
      recallRelevantLongTermEntriesAsync: async (_bookId: string, queryTerms: string[]) =>
        queryTerms.length === 3
          ? (options?.protectedFacts ?? [
              { summary: 'hero 必须继续隐藏身份', importance: 80 },
              { summary: '低优先记忆', importance: 40 },
            ])
          : (options?.recalledEntries ?? [{ summary: '王城阴谋正在升级', importance: 90 }]),
    },
    hookStateRepository: {
      listActiveByBookId: () => options?.activeHookStates ?? [{ hookId: 'hook-1', status: 'foreshadowed' }],
      listActiveByBookIdAsync: async () => options?.activeHookStates ?? [{ hookId: 'hook-1', status: 'foreshadowed' }],
    },
    hookPressureRepository: {
      listActiveByBookId: () => options?.hookPressures ?? [{ hookId: 'hook-1', riskLevel: 'high', pressureScore: 85 }],
      listActiveByBookIdAsync: async () => options?.hookPressures ?? [{ hookId: 'hook-1', riskLevel: 'high', pressureScore: 85 }],
    },
    narrativeDebtRepository: {
      listOpenByBookId: () => options?.openNarrativeDebts ?? [{ id: 'debt-1', summary: '需要回收旧伏笔' }],
      listOpenByBookIdAsync: async () => options?.openNarrativeDebts ?? [{ id: 'debt-1', summary: '需要回收旧伏笔' }],
    },
  }

  return new PlanningContextBuilder(
    deps.bookRepository as never,
    deps.outlineRepository as never,
    deps.chapterRepository as never,
    deps.volumeRepository as never,
    deps.volumePlanRepository as never,
    deps.storyThreadRepository as never,
    deps.endingReadinessRepository as never,
    deps.characterCurrentStateRepository as never,
    deps.characterArcRepository as never,
    deps.itemCurrentStateRepository as never,
    deps.memoryRepository as never,
    deps.hookStateRepository as never,
    deps.hookPressureRepository as never,
    deps.narrativeDebtRepository as never,
  )
}

test('PlanningContextBuilder build rejects missing core resources and assembles planning context', () => {
  assert.throws(() => createPlanningBuilder({ book: null }).build('chapter-1'), /Project is not initialized/)
  assert.throws(() => createPlanningBuilder({ outline: null }).build('chapter-1'), /Outline is required before planning a chapter/)
  assert.throws(() => createPlanningBuilder({ chapter: null }).build('chapter-1'), /Chapter not found: chapter-1/)
  assert.throws(() => createPlanningBuilder({ volume: null }).build('chapter-1'), /Volume not found for chapter: chapter-1/)

  const volumePlan = createVolumePlanFixture({
    chapterMissions: [
      {
        id: 'mission-3',
        bookId: 'book-1',
        volumeId: 'volume-1',
        chapterId: 'chapter-3',
        threadId: 'thread-1',
        missionType: 'advance',
        summary: '让王城线明显推进',
        successSignal: '至少推进一条卷级线程',
        priority: 'high',
        createdAt: '2026-04-06T00:00:00.000Z',
        updatedAt: '2026-04-06T00:00:00.000Z',
      },
    ],
  })
  const context = createPlanningBuilder({ volumePlan }).build('chapter-3')

  assert.equal(context.book.id, 'book-1')
  assert.equal(context.volume.id, 'volume-1')
  assert.equal(context.currentChapterMission?.chapterId, 'chapter-3')
  assert.deepEqual(context.protectedFactConstraints, ['hero 必须继续隐藏身份'])
  assert.equal(context.memoryRecall.relevantLongTermEntries[0]?.summary, '王城阴谋正在升级')
  assert.equal(context.narrativePressure.highPressureHooks.length, 1)
  assert.equal(context.characterPresenceWindows[0]?.priority, 'featured')
  assert.equal(context.characterPresenceWindows[1]?.priority, 'supporting')
  assert.equal(context.ensembleBalanceReport.neglectedThreadIds[0], 'thread-1')
  assert.equal(context.ensembleBalanceReport.subplotCarryRequirements[0]?.urgency, 'high')
})

test('PlanningContextBuilder buildAsync mirrors async dependencies and preserves derived context', async () => {
  const context = await createPlanningBuilder().buildAsync('chapter-3')
  assert.equal(context.chapter.id, 'chapter-3')
  assert.equal(context.memoryRecall.shortTermSummaries[0], '前情')
  assert.equal(context.memoryRecall.observationEntries[0]?.summary, '守卫增多')
  assert.equal(context.activeStoryThreads.length, 2)
  assert.equal(context.endingReadiness?.targetVolumeId, 'volume-1')
})

test('WritingContextBuilder build/buildAsync derive scene tasks and execution rules', async () => {
  const planningContext = createPlanningBuilder({
    chapter: createChapterFixture({ id: 'chapter-1', currentPlanVersionId: 'plan-version-1' }),
    volumePlan: createVolumePlanFixture(),
  }).build('chapter-1')

  const chapterPlan = createChapterPlanFixture({
    versionId: 'plan-version-1',
    chapterId: 'chapter-1',
    endingDrive: '章末抛出更大的谜团',
  })

  const planningContextBuilderStub = {
    build: () => planningContext,
    buildAsync: async () => planningContext,
  }
  const chapterPlanRepositoryStub = {
    getByVersionId: () => chapterPlan,
    getByVersionIdAsync: async () => chapterPlan,
  }

  const builder = new WritingContextBuilder(planningContextBuilderStub as never, chapterPlanRepositoryStub as never)
  const syncContext = builder.build('chapter-1')
  const asyncContext = await builder.buildAsync('chapter-1')

  assert.equal(syncContext.chapterPlan.versionId, 'plan-version-1')
  assert.equal(syncContext.sceneTasks.goals.length > 0, true)
  assert.equal(syncContext.writingQualityContract.volumeExecutionRules.some((item) => item.includes('mission 可被读者感知')), true)
  assert.equal(syncContext.writingQualityContract.volumeExecutionRules.some((item) => item.includes('章末抛出更大的谜团')), true)
  assert.equal(syncContext.toneConstraints[0]?.label, 'genre')
  assert.equal(syncContext.narrativeVoiceConstraint.pointOfView, 'third-person-limited')
  assert.equal(syncContext.emotionalCurve.targetIntensity, 'medium')
  assert.equal(asyncContext.chapterPlan.id, chapterPlan.id)
})

test('WritingContextBuilder rejects missing plan version or missing chapter plan', async () => {
  const planningContextWithoutVersion = {
    ...createPlanningBuilder().build('chapter-3'),
    chapter: createChapterFixture({ id: 'chapter-3', currentPlanVersionId: undefined }),
  }

  const builderWithoutVersion = new WritingContextBuilder(
    {
      build: () => planningContextWithoutVersion,
      buildAsync: async () => planningContextWithoutVersion,
    } as never,
    {
      getByVersionId: () => null,
      getByVersionIdAsync: async () => null,
    } as never,
  )

  assert.throws(() => builderWithoutVersion.build('chapter-3'), /Current chapter plan is missing/)
  await assert.rejects(() => builderWithoutVersion.buildAsync('chapter-3'), /Current chapter plan is missing/)

  const planningContextWithVersion = {
    ...createPlanningBuilder().build('chapter-3'),
    chapter: createChapterFixture({ id: 'chapter-3', currentPlanVersionId: 'missing-plan' }),
  }

  const builderWithoutPlan = new WritingContextBuilder(
    {
      build: () => planningContextWithVersion,
      buildAsync: async () => planningContextWithVersion,
    } as never,
    {
      getByVersionId: () => null,
      getByVersionIdAsync: async () => null,
    } as never,
  )

  assert.throws(() => builderWithoutPlan.build('chapter-3'), /Current chapter plan is missing/)
  await assert.rejects(() => builderWithoutPlan.buildAsync('chapter-3'), /Current chapter plan is missing/)
  assert.ok(new NovelError('x') instanceof Error)
})