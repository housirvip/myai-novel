import assert from 'node:assert/strict'
import test from 'node:test'

import { loadWorkflowMissionView, loadWorkflowVolumeReviewView } from '../../../src/cli/commands/workflow-services.js'
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

test('loadWorkflowMissionView returns chapter, latest volume plan and matched mission', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
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