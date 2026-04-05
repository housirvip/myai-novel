import assert from 'node:assert/strict'
import test from 'node:test'

import type { ChapterPlan } from '../../../../src/shared/types/domain.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

function createPlan(versionSuffix: string, createdAt: string): ChapterPlan {
  return {
    id: `plan-${versionSuffix}`,
    bookId: 'book-1',
    chapterId: 'chapter-1',
    versionId: `plan-version-${versionSuffix}`,
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
    sceneEmotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' as const }],
    sceneOutcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
    requiredCharacterIds: ['hero'],
    requiredLocationIds: ['fortress'],
    requiredFactionIds: [],
    requiredItemIds: ['map'],
    eventOutline: ['潜入据点', '发现密信'],
    hookPlan: [{ hookId: 'hook-1', action: 'advance' as const, note: '推进旧谜团' }],
    statePredictions: ['hero：获得新线索'],
    memoryCandidates: ['敌营异动'],
    highPressureHookIds: ['hook-1'],
    characterArcTargets: ['hero:成长:怀疑'],
    debtCarryTargets: ['promise：兑现旧约'],
    missionId: 'mission-1',
    threadFocus: ['thread-1'],
    windowRole: 'advance',
    carryInTasks: ['承接前夜局势'],
    carryOutTasks: ['把线索交棒到下一章'],
    ensembleFocusCharacterIds: ['hero'],
    subplotCarryThreadIds: ['subplot-1'],
    endingDrive: '章末抛出新悬念',
    mustResolveDebts: ['promise：兑现旧约'],
    mustAdvanceHooks: ['hook-1'],
    mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
    llmMetadata: {
      selectedProvider: 'openai' as const,
      providerSource: 'default-provider' as const,
      selectedModel: 'gpt-openai',
      modelSource: 'provider-default' as const,
      fallbackUsed: false,
    },
    createdAt,
    approvedByUser: versionSuffix === '2',
  }
}

test('ChapterPlanRepository persists full plan payloads and resolves latest version ordering', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        const bookRepository = new BookRepository(database)
        await bookRepository.createAsync({
          id: 'book-1',
          title: '测试小说',
          genre: 'fantasy',
          styleGuide: ['紧张'],
          defaultChapterWordCount: 2200,
          chapterWordCountToleranceRatio: 0.2,
          createdAt: '2026-04-06T00:00:00.000Z',
          updatedAt: '2026-04-06T00:00:00.000Z',
        })
        await insertVolumeAndChapter(database, { bookId: 'book-1' })

        const repository = new ChapterPlanRepository(database)
        const first = createPlan('1', '2026-04-06T00:00:00.000Z')
        const second = createPlan('2', '2026-04-06T00:10:00.000Z')

        await repository.createAsync(first)
        await repository.createAsync(second)

        const latest = await repository.getLatestByChapterIdAsync('chapter-1')
        const byVersion = await repository.getByVersionIdAsync('chapter-1', 'plan-version-1')
        const list = await repository.listByChapterIdAsync('chapter-1')

        assert.equal(latest?.id, 'plan-2')
        assert.equal(latest?.approvedByUser, true)
        assert.deepEqual(byVersion, first)
        assert.equal(list.length, 2)
        assert.deepEqual(list.map((item) => item.id), ['plan-2', 'plan-1'])
        assert.deepEqual(latest?.sceneGoals, second.sceneGoals)
        assert.deepEqual(latest?.llmMetadata, second.llmMetadata)
      },
    )
  })
})