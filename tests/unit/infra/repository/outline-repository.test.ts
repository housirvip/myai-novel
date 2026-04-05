import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { OutlineRepository } from '../../../../src/infra/repository/outline-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createOutlineFixture } from '../../../helpers/domain-fixtures.js'
import { withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('OutlineRepository upsert persists and updates outline by book id', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        await new BookRepository(database).createAsync(createBookFixture())
        const repository = new OutlineRepository(database)

        const first = createOutlineFixture()
        const second = createOutlineFixture({
          theme: '自由意志',
          coreConflicts: ['王城阴谋', '自由与秩序冲突'],
          updatedAt: '2026-04-06T00:30:00.000Z',
        })

        await repository.upsertAsync(first)
        await repository.upsertAsync(second)

        const loaded = await repository.getByBookIdAsync('book-1')
        assert.deepEqual(loaded, second)
      },
    )
  })
})