import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// book 表除了作品基本信息，还会把当前 provider/model 默认值快照进项目主记录。
test('BookRepository persists and reads the first book with provider defaults', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai-compatible',
        OPENAI_MODEL: 'gpt-openai',
        OPENAI_COMPATIBLE_MODEL: 'gpt-router',
      },
      async () => {
        const repository = new BookRepository(database)
        const book = {
          id: 'book-1',
          title: '测试小说',
          genre: 'fantasy',
          styleGuide: ['紧张', '克制'],
          defaultChapterWordCount: 2200,
          chapterWordCountToleranceRatio: 0.2,
          createdAt: '2026-04-06T00:00:00.000Z',
          updatedAt: '2026-04-06T00:00:00.000Z',
        }

        await repository.createAsync(book)

        const first = await repository.getFirstAsync()
        const byId = await repository.getByIdAsync('book-1')
        const raw = await database.dbAsync.get<{ model_provider: string; model_name: string }>(
          'SELECT model_provider, model_name FROM books WHERE id = ?',
          'book-1',
        )

        // 这里既校验 domain 对象往返，也校验底层落库的 provider/model 默认值是否来自环境配置。
        assert.deepEqual(first, book)
        assert.deepEqual(byId, book)
        assert.deepEqual(raw, {
          model_provider: 'openai-compatible',
          model_name: 'gpt-router',
        })
      },
    )
  })
})
