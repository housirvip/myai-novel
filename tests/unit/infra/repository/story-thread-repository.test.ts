import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { StoryThreadRepository } from '../../../../src/infra/repository/story-thread-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createStoryThreadFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('StoryThreadRepository supports batch create, active list, volume list and upsert', async () => {
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

        const repository = new StoryThreadRepository(database)
        const active = createStoryThreadFixture()
        const paused = createStoryThreadFixture({
          id: 'thread-2',
          title: '支线',
          status: 'paused',
          priority: 'medium',
          updatedAt: '2026-04-06T00:05:00.000Z',
        })

        await repository.createBatchAsync([active, paused])
        await repository.upsertAsync(
          createStoryThreadFixture({
            id: 'thread-1',
            title: '王城线（更新）',
            updatedAt: '2026-04-06T00:10:00.000Z',
          }),
        )

        const activeList = await repository.listActiveByBookIdAsync('book-1')
        const volumeList = await repository.listByVolumeIdAsync('volume-1')

        assert.deepEqual(activeList.map((item) => item.id), ['thread-1'])
        assert.equal(activeList[0]?.title, '王城线（更新）')
        assert.deepEqual(volumeList.map((item) => item.id), ['thread-1', 'thread-2'])
      },
    )
  })
})