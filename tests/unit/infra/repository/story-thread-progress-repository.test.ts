import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { StoryThreadProgressRepository } from '../../../../src/infra/repository/story-thread-progress-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createStoryThreadProgressFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// story_thread_progress 是追加式历史表，这里同时验证 latest、全书列表和章节窗口三种读取方式。
test('StoryThreadProgressRepository supports latest/list/window queries', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
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
          `INSERT INTO chapters (
            id, book_id, volume_id, chapter_index, title, objective, planned_beats_json,
            status, current_plan_version_id, current_version_id, draft_path, final_path,
            approved_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          'chapter-2',
          'book-1',
          'volume-1',
          2,
          '余波',
          '继续推进',
          JSON.stringify(['推进后续']),
          'planned',
          null,
          null,
          null,
          null,
          null,
          '2026-04-06T00:10:00.000Z',
          '2026-04-06T00:10:00.000Z',
        )

        const repository = new StoryThreadProgressRepository(database)
        const first = createStoryThreadProgressFixture()
        const second = createStoryThreadProgressFixture({
          id: 'thread-progress-2',
          chapterId: 'chapter-2',
          summary: '王城线继续推进',
          createdAt: '2026-04-06T00:20:00.000Z',
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        // 第二条 progress 更晚，应该成为 latest，也应排在 book/window 列表前面。
        const latest = await repository.getLatestByThreadIdAsync('thread-1')
        const byBook = await repository.listByBookIdAsync('book-1')
        const byWindow = await repository.listRecentByChapterWindowAsync('book-1', 'chapter-1', 'chapter-2')

        assert.equal(latest?.id, 'thread-progress-2')
        assert.deepEqual(byBook.map((item) => item.id), ['thread-progress-2', 'thread-progress-1'])
        assert.deepEqual(byWindow.map((item) => item.id), ['thread-progress-2', 'thread-progress-1'])
        assert.deepEqual(latest?.impacts, second.impacts)
      },
    )
  })
})
