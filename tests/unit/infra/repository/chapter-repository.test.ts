import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterRepository } from '../../../../src/infra/repository/chapter-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createChapterFixture } from '../../../helpers/domain-fixtures.js'
import { withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('ChapterRepository supports create, sequencing and workflow state transitions', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        await new BookRepository(database).createAsync(createBookFixture())
        await database.dbAsync.run(
          `INSERT INTO volumes (
            id, book_id, title, goal, summary, chapter_ids_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          'volume-1',
          'book-1',
          '第一卷',
          '逼近真相',
          '卷摘要',
          JSON.stringify(['chapter-1', 'chapter-2']),
          '2026-04-06T00:00:00.000Z',
          '2026-04-06T00:00:00.000Z',
        )

        const repository = new ChapterRepository(database)
        const first = createChapterFixture()
        const second = createChapterFixture({
          id: 'chapter-2',
          index: 2,
          title: '余波',
          objective: '推进下一步',
          createdAt: '2026-04-06T00:10:00.000Z',
          updatedAt: '2026-04-06T00:10:00.000Z',
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        assert.equal(await repository.getNextIndexAsync('book-1'), 3)
        assert.equal((await repository.getPreviousChapterAsync('book-1', 2))?.id, 'chapter-1')

        await repository.updateCurrentPlanVersionAsync('chapter-1', 'plan-version-1', '2026-04-06T00:20:00.000Z')
        await repository.markDraftedAsync('chapter-1', 'draft-version-1', 'drafts/ch1.md', '2026-04-06T00:21:00.000Z')
        await repository.markReviewedAsync('chapter-1', '2026-04-06T00:22:00.000Z')
        await repository.updateCurrentVersionAsync('chapter-1', 'rewrite-version-1', '2026-04-06T00:23:00.000Z')
        await repository.finalizeChapterAsync(
          'chapter-1',
          'final-version-1',
          'final/ch1.md',
          '本章完成收束并抛出后续悬念',
          '2026-04-06T00:24:00.000Z',
        )

        const loaded = await repository.getByIdAsync('chapter-1')
        const list = await repository.listByBookIdAsync('book-1')

        assert.equal(loaded?.status, 'finalized')
        assert.equal(loaded?.currentPlanVersionId, 'plan-version-1')
        assert.equal(loaded?.currentVersionId, 'final-version-1')
        assert.equal(loaded?.draftPath, 'drafts/ch1.md')
        assert.equal(loaded?.finalPath, 'final/ch1.md')
        assert.equal(loaded?.summary, '本章完成收束并抛出后续悬念')
        assert.deepEqual(list.map((item) => item.id), ['chapter-1', 'chapter-2'])
      },
    )
  })
})