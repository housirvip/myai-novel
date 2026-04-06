import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
} from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// chapter_drafts 同样是按版本追加的历史表，这里验证 latest/byId/list 三种常用读取口径。
test('ChapterDraftRepository persists drafts and resolves latest/byId/list queries', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        await new BookRepository(database).createAsync(createBookFixture())
        await insertVolumeAndChapter(database, { bookId: 'book-1' })
        await new ChapterPlanRepository(database).createAsync(createChapterPlanFixture())

        const repository = new ChapterDraftRepository(database)
        const first = createChapterDraftFixture()
        const second = createChapterDraftFixture({
          id: 'draft-2',
          versionId: 'draft-version-2',
          content: '第二版正文草稿',
          actualWordCount: 1500,
          createdAt: '2026-04-06T00:12:00.000Z',
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        // newer createdAt 的 draft 应排在 latest/list 首位。
        const latest = await repository.getLatestByChapterIdAsync('chapter-1')
        const byId = await repository.getByIdAsync('draft-1')
        const list = await repository.listByChapterIdAsync('chapter-1')

        assert.equal(latest?.id, 'draft-2')
        assert.equal(latest?.content, '第二版正文草稿')
        assert.deepEqual(byId, first)
        assert.deepEqual(list.map((item) => item.id), ['draft-2', 'draft-1'])
      },
    )
  })
})
