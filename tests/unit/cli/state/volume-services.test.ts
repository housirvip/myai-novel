import assert from 'node:assert/strict'
import test from 'node:test'

import { loadStateVolumeView, loadStateVolumeViewAsync } from '../../../../src/cli/commands/state/volume-services.js'
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

// state volume 的测试关注“卷级当前态”是否被完整拼出来，而不是 workflow 历史明细。
test('loadStateVolumeView and loadStateVolumeViewAsync aggregate volume snapshot', async () => {
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

      // 这里把 volume plan、threads、ending readiness 三个卷级快照都准备齐，验证聚合口径。
      const view = loadStateVolumeView(database, 'volume-1')
      const asyncView = await loadStateVolumeViewAsync(database, 'volume-1')

      assert.equal(view.book.id, 'book-1')
      assert.equal(view.volume.id, 'volume-1')
      assert.equal(view.chapters.length, 1)
      assert.equal((view.latestVolumePlan as any)?.id, 'volume-plan-1')
      assert.equal((view.storyThreads as any[]).length, 1)
      assert.equal((view.endingReadiness as any)?.targetVolumeId, 'volume-1')
      assert.equal(asyncView.volume.id, 'volume-1')
      assert.equal((asyncView.storyThreads as any[]).length, 1)
    })
  })
})

test('loadStateVolumeView and loadStateVolumeViewAsync reject missing project or volume', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadStateVolumeView(database, 'volume-1'), NovelError)
    await assert.rejects(() => loadStateVolumeViewAsync(database, 'volume-1'), NovelError)

    await withEnv({ ...resetEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      assert.throws(() => loadStateVolumeView(database, 'missing-volume'), NovelError)
      await assert.rejects(() => loadStateVolumeViewAsync(database, 'missing-volume'), NovelError)
    })
  })
})
