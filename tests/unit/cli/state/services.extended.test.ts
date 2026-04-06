import assert from 'node:assert/strict'
import test from 'node:test'

import {
  loadStateEndingView,
  loadStateEndingViewAsync,
  loadStateThreadsView,
  loadStateThreadsViewAsync,
  loadStateVolumePlanView,
  loadStateVolumePlanViewAsync,
} from '../../../../src/cli/commands/state/services.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { VolumePlanRepository } from '../../../../src/infra/repository/volume-plan-repository.js'
import { NovelError } from '../../../../src/shared/utils/errors.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createEndingReadinessFixture,
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

test('loadStateThreadsView returns volume-scoped active threads and recent progress', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

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
      await database.dbAsync.run(
        `INSERT INTO story_thread_progress (
          id, book_id, thread_id, chapter_id, progress_status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'progress-1',
        'book-1',
        'thread-1',
        'chapter-1',
        'advanced',
        '王城线推进',
        JSON.stringify([{ threadId: 'thread-1', impactType: 'advance', summary: '推进主线' }]),
        '2026-04-06T00:10:00.000Z',
      )

      const view = loadStateThreadsView(database, 'volume-1')

      assert.equal(view.book.id, 'book-1')
      assert.equal(view.volume?.id, 'volume-1')
      assert.equal(view.activeThreads.length, 1)
      assert.equal(view.recentProgress.length, 1)
    })
  })
})

test('loadStateVolumePlanView and loadStateEndingView return persisted volume director snapshots', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())
      await database.dbAsync.run(
        `INSERT INTO ending_readiness_current (
          book_id, target_volume_id, readiness_score, closure_score,
          pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'book-1',
        'volume-1',
        65,
        55,
        JSON.stringify(createEndingReadinessFixture().pendingPayoffs),
        JSON.stringify(createEndingReadinessFixture().closureGaps),
        JSON.stringify(createEndingReadinessFixture().finalConflictPrerequisites),
        '2026-04-06T00:00:00.000Z',
      )

      const volumePlanView = loadStateVolumePlanView(database, 'volume-1')
      const endingView = loadStateEndingView(database)

      assert.equal(volumePlanView.volume.id, 'volume-1')
      assert.equal((volumePlanView.latestVolumePlan as any)?.id, 'volume-plan-1')
      assert.equal((endingView.endingReadiness as any)?.targetVolumeId, 'volume-1')
    })
  })
})

test('loadStateThreadsView and loadStateVolumePlanView throw for missing project or volume', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadStateThreadsView(database, 'volume-1'), NovelError)
    assert.throws(() => loadStateVolumePlanView(database, 'volume-1'), NovelError)
    assert.throws(() => loadStateEndingView(database), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      assert.throws(() => loadStateThreadsView(database, 'missing-volume'), NovelError)
      assert.throws(() => loadStateVolumePlanView(database, 'missing-volume'), NovelError)
    })
  })
})

test('loadStateThreadsViewAsync, loadStateEndingViewAsync and loadStateVolumePlanViewAsync return async snapshots', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
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
      await database.dbAsync.run(
        `INSERT INTO story_thread_progress (
          id, book_id, thread_id, chapter_id, progress_status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'progress-1',
        'book-1',
        'thread-1',
        'chapter-1',
        'advanced',
        '王城线推进',
        JSON.stringify([{ threadId: 'thread-1', impactType: 'advance', summary: '推进主线' }]),
        '2026-04-06T00:10:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO ending_readiness_current (
          book_id, target_volume_id, readiness_score, closure_score,
          pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'book-1',
        'volume-1',
        65,
        55,
        JSON.stringify(createEndingReadinessFixture().pendingPayoffs),
        JSON.stringify(createEndingReadinessFixture().closureGaps),
        JSON.stringify(createEndingReadinessFixture().finalConflictPrerequisites),
        '2026-04-06T00:00:00.000Z',
      )

      const threadsView = await loadStateThreadsViewAsync(database, 'volume-1')
      const endingView = await loadStateEndingViewAsync(database)
      const volumePlanView = await loadStateVolumePlanViewAsync(database, 'volume-1')

      assert.equal(threadsView.activeThreads.length, 1)
      assert.equal(threadsView.recentProgress.length, 1)
      assert.equal((endingView.endingReadiness as any)?.targetVolumeId, 'volume-1')
      assert.equal((volumePlanView.latestVolumePlan as any)?.id, 'volume-plan-1')
    })
  })
})

test('loadStateThreadsViewAsync, loadStateEndingViewAsync and loadStateVolumePlanViewAsync reject on missing resources', async () => {
  await withSqliteDatabase(async (database) => {
    await assert.rejects(() => loadStateThreadsViewAsync(database, 'volume-1'), NovelError)
    await assert.rejects(() => loadStateEndingViewAsync(database), NovelError)
    await assert.rejects(() => loadStateVolumePlanViewAsync(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await assert.rejects(() => loadStateThreadsViewAsync(database, 'missing-volume'), NovelError)
      await assert.rejects(() => loadStateVolumePlanViewAsync(database, 'missing-volume'), NovelError)
    })
  })
})