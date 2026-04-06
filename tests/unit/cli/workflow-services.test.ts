import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createWorkflowGenerationService,
  createWorkflowPlanningContextBuilder,
  createWorkflowPlanningService,
  createWorkflowReviewService,
  createWorkflowVolumePlanRepository,
  createWorkflowWritingContextBuilder,
  loadWorkflowMissionView,
  loadWorkflowMissionViewAsync,
  loadWorkflowVolumeReviewView,
  loadWorkflowVolumeReviewViewAsync,
} from '../../../src/cli/commands/workflow-services.js'
import { PlanningContextBuilder } from '../../../src/core/context/planning-context-builder.js'
import { WritingContextBuilder } from '../../../src/core/context/writing-context-builder.js'
import { GenerationService } from '../../../src/core/generation/service.js'
import { PlanningService } from '../../../src/core/planning/service.js'
import { ReviewService } from '../../../src/core/review/service.js'
import { NovelError } from '../../../src/shared/utils/errors.js'
import { BookRepository } from '../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../../src/infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../../src/infra/repository/chapter-review-repository.js'
import { VolumePlanRepository } from '../../../src/infra/repository/volume-plan-repository.js'
import { withEnv } from '../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
  createReviewReportFixture,
  createStoryThreadFixture,
  createVolumePlanFixture,
} from '../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../helpers/sqlite.js'

const resetEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// workflow-services 的测试重点不是模型行为，而是 CLI 装配层有没有把正确的 builder/service/view 拼起来。
test('workflow service factories create the expected builder, repository and service instances', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv }, async () => {
      const planningContextBuilder = createWorkflowPlanningContextBuilder(database)
      const planningService = createWorkflowPlanningService(database)
      const volumePlanRepository = createWorkflowVolumePlanRepository(database)
      const writingContextBuilder = createWorkflowWritingContextBuilder(database)
      const generationService = createWorkflowGenerationService(database)
      const reviewService = createWorkflowReviewService(database)

      assert.ok(planningContextBuilder instanceof PlanningContextBuilder)
      assert.ok(planningService instanceof PlanningService)
      assert.ok(volumePlanRepository instanceof VolumePlanRepository)
      assert.ok(writingContextBuilder instanceof WritingContextBuilder)
      assert.ok(generationService instanceof GenerationService)
      assert.ok(reviewService instanceof ReviewService)
    })
  })
})

test('loadWorkflowMissionView returns chapter, latest volume plan and matched mission', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      // mission 必须来自最新 volume plan，而不是章节自身字段。
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())

      const view = loadWorkflowMissionView(database, 'chapter-1')

      assert.equal(view.chapter.id, 'chapter-1')
      assert.equal((view.volumePlan as any)?.id, 'volume-plan-1')
      assert.equal((view.mission as any)?.chapterId, 'chapter-1')
    })
  })
})

test('loadWorkflowVolumeReviewView aggregates chapter reviews under a volume', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await new ChapterPlanRepository(database).createAsync(createChapterPlanFixture())
      await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
      await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())
      // 这里手工插入一条 thread，覆盖 volume review 视图里“章节审阅 + 线程信息并排聚合”的场景。
      await database.dbAsync.run(
        `INSERT INTO story_threads (
          id, book_id, volume_id, title, thread_type, summary, priority, stage,
          linked_character_ids_json, linked_hook_ids_json, target_outcome, status,
          updated_by_chapter_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'thread-1',
        'book-1',
        'volume-1',
        '王城线',
        'main',
        '围绕王城阴谋持续推进',
        'high',
        'developing',
        JSON.stringify([]),
        JSON.stringify([]),
        '逼近真相',
        'active',
        'chapter-1',
        '2026-04-06T00:00:00.000Z',
      )

      const view = loadWorkflowVolumeReviewView(database, 'volume-1')

      assert.equal(view.volume.id, 'volume-1')
      assert.equal((view.latestVolumePlan as any)?.id, 'volume-plan-1')
      assert.equal(view.storyThreads.length, 1)
      assert.equal(view.chapterReviews.length, 1)
      assert.equal((view.chapterReviews[0] as any)?.latestReview?.id, 'review-1')
    })
  })
})

test('loadWorkflowMissionView throws when chapter is missing', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadWorkflowMissionView(database, 'missing-chapter'), NovelError)
  })
})

test('loadWorkflowVolumeReviewView throws when project is not initialized or volume is missing', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadWorkflowVolumeReviewView(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      assert.throws(() => loadWorkflowVolumeReviewView(database, 'missing-volume'), NovelError)
    })
  })
})

test('loadWorkflowMissionViewAsync and loadWorkflowVolumeReviewViewAsync return async views', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await new ChapterPlanRepository(database).createAsync(createChapterPlanFixture())
      await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
      await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())

      // async 版本应与同步版本语义一致，只是数据读取路径不同。
      const missionView = await loadWorkflowMissionViewAsync(database, 'chapter-1')
      const reviewView = await loadWorkflowVolumeReviewViewAsync(database, 'volume-1')

      assert.equal(missionView.chapter.id, 'chapter-1')
      assert.equal((missionView.mission as any)?.chapterId, 'chapter-1')
      assert.equal(reviewView.volume.id, 'volume-1')
      assert.equal(reviewView.chapterReviews.length, 1)
    })
  })
})

test('loadWorkflowMissionViewAsync and loadWorkflowVolumeReviewViewAsync reject on missing resources', async () => {
  await withSqliteDatabase(async (database) => {
    await assert.rejects(() => loadWorkflowMissionViewAsync(database, 'missing-chapter'), NovelError)
    await assert.rejects(() => loadWorkflowVolumeReviewViewAsync(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await assert.rejects(() => loadWorkflowVolumeReviewViewAsync(database, 'missing-volume'), NovelError)
    })
  })
})
