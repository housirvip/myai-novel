import assert from 'node:assert/strict'
import test from 'node:test'

import { executeRegressionCase, executeVolumeRegressionSuite } from '../../../../src/cli/commands/regression/services.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../../../src/infra/repository/chapter-review-repository.js'
import { VolumePlanRepository } from '../../../../src/infra/repository/volume-plan-repository.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
  createEndingReadinessFixture,
  createReviewReportFixture,
  createStoryThreadProgressFixture,
  createVolumePlanFixture,
} from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

async function seedVolumeRegressionProject(database: Parameters<typeof executeRegressionCase>[0]) {
  await new BookRepository(database!).createAsync(createBookFixture())
  await insertVolumeAndChapter(database!, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
  await new ChapterPlanRepository(database!).createAsync(createChapterPlanFixture())
  await new ChapterDraftRepository(database!).createAsync(createChapterDraftFixture())
  await new ChapterReviewRepository(database!).createAsync(createReviewReportFixture())
  await new VolumePlanRepository(database!).createAsync(createVolumePlanFixture())

  await database!.dbAsync.run(
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

  await database!.dbAsync.run(
    `INSERT INTO story_thread_progress (
      id, book_id, thread_id, chapter_id, progress_status, summary, detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'progress-1',
    'book-1',
    'thread-1',
    'chapter-1',
    'advanced',
    '王城线推进',
    JSON.stringify(createStoryThreadProgressFixture().impacts),
    '2026-04-06T00:10:00.000Z',
  )

  const readiness = createEndingReadinessFixture()
  await database!.dbAsync.run(
    `INSERT INTO ending_readiness_current (
      book_id, target_volume_id, readiness_score, closure_score,
      pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    readiness.bookId,
    readiness.targetVolumeId,
    readiness.readinessScore,
    readiness.closureScore,
    JSON.stringify(readiness.pendingPayoffs),
    JSON.stringify([]),
    JSON.stringify([]),
    readiness.updatedAt,
  )
}

test('executeRegressionCase covers volume plan, mission carry, thread progression and ending readiness paths', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await seedVolumeRegressionProject(database)

      const volumePlan = await executeRegressionCase(database, 'volume-plan-smoke', 'volume-1')
      const missionCarry = await executeRegressionCase(database, 'mission-carry-smoke', 'chapter-1')
      const threadProgress = await executeRegressionCase(database, 'thread-progression-smoke', 'volume-1')
      const endingReadiness = await executeRegressionCase(database, 'ending-readiness-smoke', 'volume-1')

      assert.equal(volumePlan.status, 'pass')
      assert.equal(missionCarry.status, 'pass')
      assert.equal(threadProgress.status, 'pass')
      assert.equal(endingReadiness.status, 'pass')
      assert.match(volumePlan.summary, /volume plan/i)
      assert.match(missionCarry.summary, /mission/i)
      assert.match(threadProgress.summary, /Thread focus/i)
      assert.match(endingReadiness.summary, /Ending readiness/i)
    })
  })
})

test('executeRegressionCase volume-doctor-smoke passes on low-risk volume and warns on missing target', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await seedVolumeRegressionProject(database)

      const ok = await executeRegressionCase(database, 'volume-doctor-smoke', 'volume-1')
      const missing = await executeRegressionCase(database, 'volume-doctor-smoke')

      assert.equal(ok.status, 'pass')
      assert.equal(ok.steps[1]?.status, 'pass')
      assert.equal(missing.status, 'missing-prerequisite')
      assert.equal(missing.steps[0]?.name, 'resolve-target')
    })
  })
})

test('executeVolumeRegressionSuite aggregates built-in volume cases into a passing suite summary', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await seedVolumeRegressionProject(database)

      const result = await executeVolumeRegressionSuite(database, 'volume-1')

      assert.equal(result.volumeId, 'volume-1')
      assert.equal(result.caseCount, 4)
      assert.equal(result.passedCount, 4)
      assert.equal(result.warningCount, 0)
      assert.equal(result.missingPrerequisiteCount, 0)
      assert.match(result.summary, /passed/i)
    })
  })
})