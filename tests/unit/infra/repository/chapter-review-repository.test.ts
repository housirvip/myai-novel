import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../../../src/infra/repository/chapter-review-repository.js'
import { withEnv } from '../../../helpers/env.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
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

test('ChapterReviewRepository persists review payloads and resolves latest ordering', async () => {
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

        const repository = new ChapterReviewRepository(database)
        const first = createReviewReportFixture()
        const second = createReviewReportFixture({
          id: 'review-2',
          decision: 'needs-rewrite',
          createdAt: '2026-04-06T00:20:00.000Z',
          revisionAdvice: ['必须重写'],
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        const latest = await repository.getLatestByChapterIdAsync('chapter-1')
        const byId = await repository.getByIdAsync('review-1')
        const list = await repository.listByChapterIdAsync('chapter-1')

        assert.equal(latest?.id, 'review-2')
        assert.equal(latest?.decision, 'needs-rewrite')
        assert.deepEqual(byId, first)
        assert.deepEqual(list.map((item) => item.id), ['review-2', 'review-1'])
        assert.deepEqual(latest?.reviewLayers, second.reviewLayers)
        assert.deepEqual(latest?.closureSuggestions, second.closureSuggestions)
      },
    )
  })
})

test('ChapterReviewRepository normalizes legacy revise decision to needs-rewrite', async () => {
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

        const legacy = createReviewReportFixture({ id: 'legacy-review' })
        await database.dbAsync.run(
          `
            INSERT INTO chapter_reviews (
              id, book_id, chapter_id, draft_id, decision,
              consistency_issues_json, character_issues_json, item_issues_json, memory_issues_json,
              pacing_issues_json, hook_issues_json, approval_risk, word_count_check_json,
              new_fact_candidates_json, closure_suggestions_json, review_layers_json,
              outcome_candidate_json, revision_advice_json, llm_metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          legacy.id,
          legacy.bookId,
          legacy.chapterId,
          legacy.draftId,
          'revise',
          JSON.stringify(legacy.consistencyIssues),
          JSON.stringify(legacy.characterIssues),
          JSON.stringify(legacy.itemIssues),
          JSON.stringify(legacy.memoryIssues),
          JSON.stringify(legacy.pacingIssues),
          JSON.stringify(legacy.hookIssues),
          legacy.approvalRisk,
          JSON.stringify(legacy.wordCountCheck),
          JSON.stringify(legacy.newFactCandidates),
          JSON.stringify(legacy.closureSuggestions),
          JSON.stringify(legacy.reviewLayers),
          JSON.stringify(legacy.outcomeCandidate),
          JSON.stringify(legacy.revisionAdvice),
          legacy.llmMetadata ? JSON.stringify(legacy.llmMetadata) : null,
          legacy.createdAt,
        )

        const loaded = await new ChapterReviewRepository(database).getByIdAsync('legacy-review')
        assert.equal(loaded?.decision, 'needs-rewrite')
      },
    )
  })
})