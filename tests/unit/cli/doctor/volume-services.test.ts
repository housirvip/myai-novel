import assert from 'node:assert/strict'
import test from 'node:test'

import { loadDoctorVolumeView, loadDoctorVolumeViewAsync } from '../../../../src/cli/commands/doctor/volume-services.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { VolumePlanRepository } from '../../../../src/infra/repository/volume-plan-repository.js'
import { NovelError } from '../../../../src/shared/utils/errors.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createEndingReadinessFixture,
  createStoryThreadFixture,
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

// doctor volume 的测试主要验证风险分层是否符合预期：
// 缺计划/缺 ending readiness 时应报高风险，数据健康时应收敛到低风险。
test('loadDoctorVolumeView reports high risks when volume plan and ending readiness are missing', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

      const view = loadDoctorVolumeView(database, 'volume-1')

      assert.equal(view.volume.id, 'volume-1')
      assert.equal(view.diagnostics.hasVolumePlan, false)
      assert.equal(view.diagnostics.endingTargetMatches, false)
      assert.ok(view.missionRisks.some((risk) => risk.code === 'mission-missing-plan'))
      assert.ok(view.endingRisks.some((risk) => risk.code === 'ending-missing-readiness'))
      assert.equal(view.overview.overallLevel, 'high')
    })
  })
})

test('loadDoctorVolumeView summarizes thread and mission diagnostics from persisted volume data', async () => {
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
        JSON.stringify(createStoryThreadProgressFixture().impacts),
        '2026-04-06T00:10:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO ending_readiness_current (
          book_id, target_volume_id, readiness_score, closure_score,
          pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'book-1',
        'volume-1',
        80,
        70,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-04-06T00:20:00.000Z',
      )

      // 这是一个“健康卷”基线：有 volume plan、有线程推进、无 closure/payout 压力。
      const view = loadDoctorVolumeView(database, 'volume-1')

      assert.equal(view.diagnostics.hasVolumePlan, true)
      assert.equal(view.diagnostics.threadCount, 1)
      assert.equal(view.diagnostics.stalledThreadCount, 0)
      assert.equal(view.diagnostics.missionChainGapCount, 0)
      assert.equal(view.diagnostics.closureGapCount, 0)
      assert.equal(view.overview.overallLevel, 'low')
    })
  })
})

test('loadDoctorVolumeView throws when project or volume is missing', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadDoctorVolumeView(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      assert.throws(() => loadDoctorVolumeView(database, 'missing-volume'), NovelError)
    })
  })
})

test('loadDoctorVolumeViewAsync mirrors the persisted healthy diagnostics view', async () => {
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
        JSON.stringify(createStoryThreadProgressFixture().impacts),
        '2026-04-06T00:10:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO ending_readiness_current (
          book_id, target_volume_id, readiness_score, closure_score,
          pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'book-1',
        'volume-1',
        80,
        70,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-04-06T00:20:00.000Z',
      )

      const view = await loadDoctorVolumeViewAsync(database, 'volume-1')

      assert.equal(view.diagnostics.hasVolumePlan, true)
      assert.equal(view.diagnostics.threadCount, 1)
      assert.equal(view.overview.overallLevel, 'low')
    })
  })
})

test('loadDoctorVolumeViewAsync rejects when project or volume is missing', async () => {
  await withSqliteDatabase(async (database) => {
    await assert.rejects(() => loadDoctorVolumeViewAsync(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await assert.rejects(() => loadDoctorVolumeViewAsync(database, 'missing-volume'), NovelError)
    })
  })
})

test('loadDoctorVolumeView surfaces mission, thread, ending and chapter risk combinations', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())

      // 这个场景故意把多类风险叠在一起，验证 doctor volume 的总体风险摘要不会漏项。
      await database.dbAsync.run(
        `INSERT INTO volumes (id, book_id, title, goal, summary, chapter_ids_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'volume-1',
        'book-1',
        '第一卷',
        '逼近真相',
        '卷摘要',
        JSON.stringify(['chapter-1', 'chapter-2']),
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO volumes (id, book_id, title, goal, summary, chapter_ids_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'volume-2',
        'book-1',
        '第二卷',
        '错位终局目标',
        '用于 ending readiness targetVolumeId 外键',
        JSON.stringify([]),
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO chapters (
          id, book_id, volume_id, chapter_index, title, objective, planned_beats_json,
          status, current_plan_version_id, current_version_id, draft_path, final_path, approved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        'chapter-1',
        'book-1',
        'volume-1',
        1,
        '暗潮',
        '查明敌营动向',
        JSON.stringify(['潜入据点']),
        'finalized',
        null,
        null,
        null,
        null,
        null,
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO chapters (
          id, book_id, volume_id, chapter_index, title, objective, planned_beats_json,
          status, current_plan_version_id, current_version_id, draft_path, final_path, approved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        'chapter-2',
        'book-1',
        'volume-1',
        2,
        '风暴前夜',
        '承接卷内危机',
        JSON.stringify(['扩大危机']),
        'drafted',
        null,
        null,
        null,
        null,
        null,
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z',
      )

      await new VolumePlanRepository(database).createAsync(
        createVolumePlanFixture({
          rollingWindow: {
            windowStartChapterIndex: 10,
            windowEndChapterIndex: 12,
            focusThreadIds: ['thread-main'],
            goal: '错误窗口',
          },
          chapterMissions: [
            {
              id: 'mission-chapter-2',
              bookId: 'book-1',
              volumeId: 'volume-1',
              chapterId: 'chapter-2',
              threadId: 'thread-subplot',
              missionType: 'advance',
              summary: '绑定未完结章节',
              successSignal: '需要在 chapter-2 完成',
              priority: 'high',
              createdAt: '2026-04-06T00:00:00.000Z',
              updatedAt: '2026-04-06T00:00:00.000Z',
            },
            {
              id: 'mission-detached',
              bookId: 'book-1',
              volumeId: 'volume-1',
              chapterId: 'chapter-missing',
              threadId: 'thread-main',
              missionType: 'advance',
              summary: '指向缺失章节',
              successSignal: '不可达成',
              priority: 'high',
              createdAt: '2026-04-06T00:00:00.000Z',
              updatedAt: '2026-04-06T00:00:00.000Z',
            },
          ],
        }),
      )

      await database.dbAsync.run(
        `INSERT INTO story_threads (
          id, book_id, volume_id, title, thread_type, summary, priority, stage,
          linked_character_ids_json, linked_hook_ids_json, target_outcome, status, updated_by_chapter_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'thread-main',
        'book-1',
        'volume-1',
        '主线谜团',
        'main',
        '围绕王城阴谋持续推进',
        'critical',
        'setup',
        JSON.stringify([]),
        JSON.stringify([]),
        '逼近真相',
        'active',
        'chapter-1',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO story_threads (
          id, book_id, volume_id, title, thread_type, summary, priority, stage,
          linked_character_ids_json, linked_hook_ids_json, target_outcome, status, updated_by_chapter_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'thread-relationship',
        'book-1',
        'volume-1',
        '人物关系线',
        'relationship',
        '关系线推进不足',
        'high',
        'developing',
        JSON.stringify([]),
        JSON.stringify([]),
        '关系变化',
        'active',
        'chapter-1',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO story_threads (
          id, book_id, volume_id, title, thread_type, summary, priority, stage,
          linked_character_ids_json, linked_hook_ids_json, target_outcome, status, updated_by_chapter_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'thread-subplot',
        'book-1',
        'volume-1',
        '支线任务',
        'subplot',
        '高优支线未承接',
        'high',
        'developing',
        JSON.stringify([]),
        JSON.stringify([]),
        '支线兑现',
        'active',
        'chapter-1',
        '2026-04-06T00:00:00.000Z',
      )
      await database.dbAsync.run(
        `INSERT INTO story_thread_progress (
          id, book_id, thread_id, chapter_id, progress_status, summary, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'progress-main',
        'book-1',
        'thread-main',
        'chapter-1',
        'stalled',
        '主线卡住',
        JSON.stringify(createStoryThreadProgressFixture().impacts),
        '2026-04-06T00:10:00.000Z',
      )

      await database.dbAsync.run(
        `INSERT INTO ending_readiness_current (
          book_id, target_volume_id, readiness_score, closure_score,
          pending_payoffs_json, closure_gaps_json, final_conflict_prerequisites_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'book-1',
        'volume-2',
        35,
        20,
        JSON.stringify([
          { summary: '回收主线伏笔', relatedThreadId: 'thread-main', targetChapterIndex: 2, status: 'pending' },
          { summary: '回收支线伏笔', relatedThreadId: 'thread-subplot', targetChapterIndex: 3, status: 'pending' },
        ]),
        JSON.stringify([
          { summary: '主线 closure gap', severity: 'high', relatedThreadId: 'thread-main' },
          { summary: '关系线 closure gap', severity: 'medium', relatedThreadId: 'thread-relationship' },
        ]),
        JSON.stringify([
          { summary: '主线前提缺失', status: 'missing', relatedThreadId: 'thread-main' },
          { summary: '支线前提仅部分达成', status: 'partial', relatedThreadId: 'thread-subplot' },
        ]),
        '2026-04-06T00:20:00.000Z',
      )

      const view = loadDoctorVolumeView(database, 'volume-1')

      assert.equal(view.diagnostics.chapterCount, 2)
      assert.equal(view.diagnostics.finalizedOutputCount, 0)
      assert.equal(view.diagnostics.stalledThreadCount >= 1, true)
      assert.equal(view.diagnostics.unfinishedChapterCount, 1)
      assert.equal(view.diagnostics.pendingPayoffPressure, 2)
      assert.equal(view.overview.overallLevel, 'high')

      assert.ok(view.missionRisks.some((risk) => risk.code === 'mission-missing-chapter'))
      assert.ok(view.missionRisks.some((risk) => risk.code === 'mission-uncovered-chapters'))
      assert.ok(view.missionRisks.some((risk) => risk.code === 'mission-window-detached'))
      assert.ok(view.threadRisks.some((risk) => risk.code === 'thread-stalled'))
      assert.ok(view.threadRisks.some((risk) => risk.code === 'thread-missing-progress'))
      assert.ok(view.threadRisks.some((risk) => risk.code === 'ensemble-thread-neglected'))
      assert.ok(view.threadRisks.some((risk) => risk.code === 'ensemble-subplot-carry-missing'))
      assert.ok(view.endingRisks.some((risk) => risk.code === 'ending-target-mismatch'))
      assert.ok(view.endingRisks.some((risk) => risk.code === 'ending-closure-gap'))
      assert.ok(view.endingRisks.some((risk) => risk.code === 'ending-pending-payoff-pressure'))
      assert.ok(view.endingRisks.some((risk) => risk.code === 'ending-final-conflict-prerequisite'))
      assert.ok(view.chapterRisks.some((risk) => risk.code === 'chapter-finalized-without-output'))
      assert.ok(view.chapterRisks.some((risk) => risk.code === 'chapter-mission-not-finished'))
    })
  })
})
