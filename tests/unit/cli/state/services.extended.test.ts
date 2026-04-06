import assert from 'node:assert/strict'
import test from 'node:test'

import {
  loadStateShowView,
  loadStateShowViewAsync,
  loadStateUpdatesView,
  loadStateUpdatesViewAsync,
  loadStoryStateView,
  loadStoryStateViewAsync,
  loadStateEndingView,
  loadStateEndingViewAsync,
  loadStateThreadsView,
  loadStateThreadsViewAsync,
  loadStateVolumePlanView,
  loadStateVolumePlanViewAsync,
} from '../../../../src/cli/commands/state/services.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterReviewRepository } from '../../../../src/infra/repository/chapter-review-repository.js'
import { VolumePlanRepository } from '../../../../src/infra/repository/volume-plan-repository.js'
import { NovelError } from '../../../../src/shared/utils/errors.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
  createEndingReadinessFixture,
  createReviewReportFixture,
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

// 这组测试补的是 state 服务装配层的“横切视图”能力：
// story/state/threads/ending/volume-plan/state-updates 都需要把不同真源拼成 CLI 可读对象。
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

      // 指定 volumeId 时，应该只看到该卷线程及其 progress。
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

      // volume plan 和 ending readiness 都是 current snapshot 读法，不涉及历史版本枚举。
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

test('loadStoryStateView and loadStoryStateViewAsync return story state snapshot and reject when project is missing', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadStoryStateView(database), NovelError)
    await assert.rejects(() => loadStoryStateViewAsync(database), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await database.dbAsync.run(
        `INSERT INTO story_current_state (book_id, current_chapter_id, recent_events_json, updated_at) VALUES (?, ?, ?, ?)`,
        'book-1',
        'chapter-1',
        JSON.stringify(['潜入成功']),
        '2026-04-06T00:00:00.000Z',
      )

      // story view 只测全局游标与 recent events，不要求展开 character/item/hook 侧信息。
      const view = loadStoryStateView(database)
      const asyncView = await loadStoryStateViewAsync(database)

      assert.equal((view.state as any)?.currentChapterId, 'chapter-1')
      assert.equal((asyncView.state as any)?.recentEvents[0], '潜入成功')
    })
  })
})

test('loadStateShowView and loadStateShowViewAsync aggregate state dashboard with current chapter title', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())
      await database.dbAsync.run(
        `INSERT INTO story_current_state (book_id, current_chapter_id, recent_events_json, updated_at) VALUES (?, ?, ?, ?)`,
        'book-1',
        'chapter-1',
        JSON.stringify(['潜入成功']),
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO characters (id, book_id, name, role, profile, motivation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'character-1',
        'book-1',
        '林泽',
        '主角',
        '谨慎',
        '查明真相',
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO character_current_state (book_id, character_id, current_location_id, status_notes_json, updated_at) VALUES (?, ?, ?, ?, ?)`,
        'book-1',
        'character-1',
        null,
        JSON.stringify(['保持潜伏']),
        '2026-04-06T00:05:00.000Z',
      )

      // 这里的重点是验证 story_current_state.currentChapterId 会被补成 currentChapterTitle。
      const view = loadStateShowView(database)
      const asyncView = await loadStateShowViewAsync(database)

      assert.equal(view.currentChapterTitle, '暗潮')
      assert.equal(view.characterNameById.get('character-1'), '林泽')
      assert.equal((view.storyState as any)?.currentChapterId, 'chapter-1')
      assert.equal((asyncView.storyState as any)?.recentEvents[0], '潜入成功')
    })
  })
})

test('loadStateUpdatesView and loadStateUpdatesViewAsync aggregate review/state/memory/hook updates by chapter', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
      await database.dbAsync.run(
        `INSERT INTO characters (id, book_id, name, role, profile, motivation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'character-1',
        'book-1',
        '林泽',
        '主角',
        '谨慎',
        '查明真相',
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO items (id, book_id, name, unit, type, description, is_unique_worldwide, is_important, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'item-1',
        'book-1',
        '密信',
        '封',
        'document',
        '关键线索',
        1,
        1,
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO hooks (id, book_id, title, source_chapter_id, description, payoff_expectation, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'hook-1',
        'book-1',
        '王城阴谋',
        'chapter-1',
        '核心悬念',
        '未来回收',
        'high',
        'open',
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await new VolumePlanRepository(database).createAsync(createVolumePlanFixture())
      await database.dbAsync.run(
        `UPDATE chapters SET current_plan_version_id = ?, current_version_id = ? WHERE id = ?`,
        'plan-version-1',
        'draft-version-1',
        'chapter-1',
      )
      await database.dbAsync.run(
        `INSERT INTO chapter_plans (
          id, book_id, chapter_id, version_id, objective, scene_cards_json,
          required_character_ids_json, required_location_ids_json, required_faction_ids_json, required_item_ids_json,
          event_outline_json, hook_plan_json, state_predictions_json, memory_candidates_json, created_at, approved_by_user,
          scene_goals_json, scene_constraints_json, scene_emotional_targets_json, scene_outcome_checklist_json,
          high_pressure_hook_ids_json, character_arc_targets_json, debt_carry_targets_json, mission_id,
          thread_focus_json, window_role, carry_in_tasks_json, carry_out_tasks_json, ensemble_focus_character_ids_json,
          subplot_carry_thread_ids_json, ending_drive, must_resolve_debts_json, must_advance_hooks_json,
          must_preserve_facts_json, llm_metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'plan-1',
        'book-1',
        'chapter-1',
        'plan-version-1',
        '查明敌营动向',
        JSON.stringify(createChapterPlanFixture().sceneCards),
        JSON.stringify(['character-1']),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(['item-1']),
        JSON.stringify(['潜入据点', '发现密信']),
        JSON.stringify([{ hookId: 'hook-1', action: 'advance', note: '推进谜团' }]),
        JSON.stringify(['角色获得新线索']),
        JSON.stringify(['敌营异动']),
        '2026-04-06T00:00:00.000Z',
        0,
        JSON.stringify(createChapterPlanFixture().sceneGoals),
        JSON.stringify(createChapterPlanFixture().sceneConstraints),
        JSON.stringify(createChapterPlanFixture().sceneEmotionalTargets),
        JSON.stringify(createChapterPlanFixture().sceneOutcomeChecklist),
        JSON.stringify(['hook-1']),
        JSON.stringify(['hero:成长:怀疑']),
        JSON.stringify(['promise：兑现旧约']),
        'mission-1',
        JSON.stringify(['thread-1']),
        'advance',
        JSON.stringify(['承接前夜局势']),
        JSON.stringify(['把线索交棒到下一章']),
        JSON.stringify(['hero']),
        JSON.stringify(['subplot-1']),
        '章末抛出新悬念',
        JSON.stringify(['promise：兑现旧约']),
        JSON.stringify(['hook-1']),
        JSON.stringify(['角色 hero 必须仍在 fortress']),
        JSON.stringify(createChapterPlanFixture().llmMetadata),
      )
      await database.dbAsync.run(
        `INSERT INTO chapter_drafts (
          id, book_id, chapter_id, version_id, chapter_plan_id, content, actual_word_count, created_at, llm_metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'draft-1',
        'book-1',
        'chapter-1',
        'draft-version-1',
        'plan-1',
        '正文草稿内容',
        1234,
        '2026-04-06T00:05:00.000Z',
        JSON.stringify(createChapterDraftFixture().llmMetadata),
      )
      await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())
      await database.dbAsync.run(
        `INSERT INTO chapter_state_updates (id, book_id, chapter_id, entity_type, entity_id, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'state-update-1',
        'book-1',
        'chapter-1',
        'character',
        'character-1',
        '角色状态更新',
        JSON.stringify({ source: 'structured-text', reason: '角色推进', evidence: ['取得密信'] }),
        '2026-04-06T00:10:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO chapter_memory_updates (id, book_id, chapter_id, memory_type, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'memory-update-1',
        'book-1',
        'chapter-1',
        'observation',
        '观察记忆更新',
        JSON.stringify({ source: 'fallback', reason: '补记观察', evidence: ['守卫增多'] }),
        '2026-04-06T00:11:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO chapter_hook_updates (id, book_id, chapter_id, hook_id, status, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'hook-update-1',
        'book-1',
        'chapter-1',
        'hook-1',
        'foreshadowed',
        'hook 推进',
        JSON.stringify({ source: 'closure-suggestion', reason: '抬高压力', evidence: ['谜团扩张'] }),
        '2026-04-06T00:12:00.000Z',
      )

      const view = loadStateUpdatesView(database, 'chapter-1')
      const asyncView = await loadStateUpdatesViewAsync(database, 'chapter-1')

      assert.equal(view.chapter?.id, 'chapter-1')
      assert.equal(view.review?.id, 'review-1')
      assert.equal(view.stateUpdates.length, 1)
      assert.equal(view.memoryUpdates.length, 1)
      assert.equal(view.hookUpdates.length, 1)
      assert.equal(view.characterNameById.get('character-1'), '林泽')
      assert.equal(view.itemNameById.get('item-1'), '密信')
      assert.equal(view.hookTitleById.get('hook-1'), '王城阴谋')
      assert.equal(asyncView.review?.decision, 'warning')
    })
  })
})
