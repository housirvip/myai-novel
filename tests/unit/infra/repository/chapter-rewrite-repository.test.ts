import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../../../src/infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../../src/infra/repository/chapter-rewrite-repository.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
  createChapterRewriteFixture,
  createReviewReportFixture,
} from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('ChapterRewriteRepository persists rewrite payloads and resolves latest ordering', async () => {
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
        await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
        await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())

        const repository = new ChapterRewriteRepository(database)
        const first = createChapterRewriteFixture()
        const second = createChapterRewriteFixture({
          id: 'rewrite-2',
          versionId: 'rewrite-version-2',
          createdAt: '2026-04-06T00:25:00.000Z',
          goals: ['彻底修复状态问题'],
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        const latest = await repository.getLatestByChapterIdAsync('chapter-1')
        const list = await repository.listByChapterIdAsync('chapter-1')

        assert.equal(latest?.id, 'rewrite-2')
        assert.deepEqual(latest?.qualityTarget, second.qualityTarget)
        assert.deepEqual(latest?.strategyProfile, second.strategyProfile)
        assert.deepEqual(list.map((item) => item.id), ['rewrite-2', 'rewrite-1'])
      },
    )
  })
})

test('ChapterRewriteRepository normalizes legacy revise validation decision to needs-rewrite', async () => {
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
        await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
        await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())

        const legacy = createChapterRewriteFixture({ id: 'legacy-rewrite' })
        await database.dbAsync.run(
          `
            INSERT INTO chapter_rewrites (
              id, book_id, chapter_id, source_draft_id, source_review_id,
              version_id, strategy, strategy_profile_json, quality_target_json,
              goals_json, content, actual_word_count, validation_json,
              llm_metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          legacy.id,
          legacy.bookId,
          legacy.chapterId,
          legacy.sourceDraftId,
          legacy.sourceReviewId,
          legacy.versionId,
          legacy.strategy,
          JSON.stringify(legacy.strategyProfile),
          JSON.stringify(legacy.qualityTarget),
          JSON.stringify(legacy.goals),
          legacy.content,
          legacy.actualWordCount,
          JSON.stringify({ ...legacy.validation, reviewDecision: 'revise' }),
          legacy.llmMetadata ? JSON.stringify(legacy.llmMetadata) : null,
          legacy.createdAt,
        )

        const loaded = await new ChapterRewriteRepository(database).getLatestByChapterIdAsync('chapter-1')
        assert.equal(loaded?.validation.reviewDecision, 'needs-rewrite')
      },
    )
  })
})