import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { EndingReadinessRepository } from '../../../../src/infra/repository/ending-readiness-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createEndingReadinessFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// ending_readiness_current 是整书级 current-state 快照，后写入应覆盖前一版分数与缺口信息。
test('EndingReadinessRepository upsert persists and updates readiness snapshot', async () => {
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

        const repository = new EndingReadinessRepository(database)
        const first = createEndingReadinessFixture()
        const second = createEndingReadinessFixture({
          readinessScore: 80,
          closureScore: 75,
          updatedAt: '2026-04-06T00:30:00.000Z',
        })

        await repository.upsertAsync(first)
        await repository.upsertAsync(second)

        // 第二次 upsert 后，读取结果应反映最新 readiness/closure 评分。
        const loaded = await repository.getByBookIdAsync('book-1')
        assert.deepEqual(loaded, second)
      },
    )
  })
})
