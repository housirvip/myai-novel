import assert from 'node:assert/strict'
import test from 'node:test'

import {
  loadDoctorBootstrapView,
  loadDoctorChapterView,
  loadDoctorChapterViewAsync,
  loadDoctorProjectView,
  loadDoctorProjectViewAsync,
} from '../../../../src/cli/commands/doctor/services.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../../src/infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../../src/infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../../src/infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../../../src/infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../../src/infra/repository/chapter-rewrite-repository.js'
import { ensureProjectDirectories, resolveProjectPaths, writeProjectConfig } from '../../../../src/shared/utils/project-paths.js'
import { withEnv } from '../../../helpers/env.js'
import { withTempDir } from '../../../helpers/fs.js'
import { withCwd } from '../../../helpers/process.js'
import {
  createBookFixture,
  createChapterDraftFixture,
  createChapterPlanFixture,
  createChapterRewriteFixture,
  createReviewReportFixture,
} from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetDoctorEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_BASE_URL: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_TIMEOUT_MS: undefined,
  OPENAI_MAX_RETRIES: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_BASE_URL: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
  OPENAI_COMPATIBLE_TIMEOUT_MS: undefined,
  OPENAI_COMPATIBLE_MAX_RETRIES: undefined,
  LLM_PLANNING_PROVIDER: undefined,
  LLM_PLANNING_MODEL: undefined,
  LLM_GENERATION_PROVIDER: undefined,
  LLM_GENERATION_MODEL: undefined,
  LLM_REVIEW_PROVIDER: undefined,
  LLM_REVIEW_MODEL: undefined,
  LLM_REWRITE_PROVIDER: undefined,
  LLM_REWRITE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('loadDoctorBootstrapView reports missing database config and unconfigured providers', async () => {
  await withTempDir(async (rootDir) => {
    await withCwd(rootDir, async () => {
      await withEnv(resetDoctorEnv, () => {
        const view = loadDoctorBootstrapView()

        assert.equal(view.projectInitialized, false)
        assert.equal(view.chapterCount, 0)
        assert.equal(view.infrastructure.database.activeBackend, 'unconfigured')
        assert.equal(view.infrastructure.database.configPresent, false)
        assert.equal(view.infrastructure.database.readiness.status, 'warning')
        assert.match(view.infrastructure.database.configPath, /config\/database\.json$/)
        assert.deepEqual(view.infrastructure.llm.availableProviders, [])
        assert.equal(view.infrastructure.llm.defaultProvider, 'openai')
        assert.equal(view.infrastructure.llm.readiness.defaultProviderConfigured, false)
        assert.equal(view.infrastructure.llm.readiness.configuredProviderCount, 0)
        assert.equal(view.infrastructure.llm.stageRouting.length, 4)
        assert.equal(view.infrastructure.llm.readiness.stageRoutingIssues.length, 4)

        const reviewStage = view.infrastructure.llm.stageRouting.find((item) => item.stage === 'review')
        assert.equal(reviewStage?.provider, 'openai')
        assert.equal(reviewStage?.providerConfigured, false)
      })
    })
  })
})

test('loadDoctorBootstrapView reflects configured backend and stage routing usage', async () => {
  await withTempDir(async (rootDir) => {
    const paths = resolveProjectPaths(rootDir)
    await ensureProjectDirectories(paths)
    await writeProjectConfig(paths, {
      database: {
        client: 'mysql',
        host: '127.0.0.1',
        port: 3306,
        user: 'novel',
        password: 'secret',
        database: 'novel_db',
      },
    })

    await withCwd(rootDir, async () => {
      await withEnv(
        {
          ...resetDoctorEnv,
          LLM_PROVIDER: 'openai-compatible',
          OPENAI_API_KEY: 'openai-key',
          OPENAI_MODEL: 'gpt-openai',
          OPENAI_COMPATIBLE_API_KEY: 'compat-key',
          OPENAI_COMPATIBLE_MODEL: 'gpt-compat',
          LLM_PLANNING_PROVIDER: 'openai',
          LLM_REVIEW_PROVIDER: 'openai-compatible',
          LLM_REVIEW_MODEL: 'review-router-model',
        },
        () => {
          const view = loadDoctorBootstrapView()

          assert.equal(view.infrastructure.database.activeBackend, 'mysql')
          assert.equal(view.infrastructure.database.configPresent, true)
          assert.equal(view.infrastructure.database.readiness.status, 'ready')

          assert.deepEqual(view.infrastructure.llm.availableProviders, ['openai', 'openai-compatible'])
          assert.equal(view.infrastructure.llm.defaultProvider, 'openai-compatible')
          assert.equal(view.infrastructure.llm.defaultModel, 'gpt-compat')
          assert.equal(view.infrastructure.llm.readiness.defaultProviderConfigured, true)
          assert.equal(view.infrastructure.llm.readiness.configuredProviderCount, 2)
          assert.equal(view.infrastructure.llm.readiness.stageRoutingIssues.length, 0)

          const openAi = view.infrastructure.llm.configuredProviders.find((item) => item.provider === 'openai')
          const compatible = view.infrastructure.llm.configuredProviders.find((item) => item.provider === 'openai-compatible')
          assert.ok(openAi)
          assert.ok(compatible)
          assert.equal(openAi.isDefault, false)
          assert.equal(compatible.isDefault, true)
          assert.ok(openAi.usedByStages.includes('planning'))
          assert.ok(compatible.usedByStages.includes('review'))

          const reviewStage = view.infrastructure.llm.stageRouting.find((item) => item.stage === 'review')
          assert.deepEqual(reviewStage, {
            stage: 'review',
            provider: 'openai-compatible',
            model: 'review-router-model',
            timeoutMs: 60000,
            maxRetries: 1,
            providerConfigured: true,
          })
        },
      )
    })
  })
})

test('loadDoctorProjectView and loadDoctorProjectViewAsync aggregate chapter workflow readiness', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetDoctorEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

      await new ChapterPlanRepository(database).createAsync(createChapterPlanFixture())
      await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
      await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())
      await new ChapterRewriteRepository(database).createAsync(createChapterRewriteFixture())
      await new ChapterOutputRepository(database).createAsync({
        id: 'output-1',
        bookId: 'book-1',
        chapterId: 'chapter-1',
        sourceType: 'rewrite',
        sourceId: 'rewrite-1',
        finalPath: 'completed/chapter-1.md',
        content: '最终章节正文',
        createdAt: '2026-04-06T00:20:00.000Z',
      })

      const view = loadDoctorProjectView(database)
      const asyncView = await loadDoctorProjectViewAsync(database)

      assert.equal(view.projectInitialized, true)
      assert.equal(view.bookId, 'book-1')
      assert.equal(view.chapterCount, 1)
      assert.equal(view.chapters[0]?.hasPlan, true)
      assert.equal(view.chapters[0]?.hasDraft, true)
      assert.equal(view.chapters[0]?.hasReview, true)
      assert.equal(view.chapters[0]?.hasRewrite, true)
      assert.equal(view.chapters[0]?.hasOutput, true)
      assert.equal(asyncView.chapters[0]?.chapterId, 'chapter-1')
    })
  })
})

test('loadDoctorProjectView and loadDoctorProjectViewAsync reject when project is missing', async () => {
  await withSqliteDatabase(async (database) => {
    assert.throws(() => loadDoctorProjectView(database), /Project is not initialized/)
    await assert.rejects(() => loadDoctorProjectViewAsync(database), /Project is not initialized/)
  })
})

test('loadDoctorChapterView and loadDoctorChapterViewAsync summarize workflow chain and missing chapter errors', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv({ ...resetDoctorEnv, LLM_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-openai' }, async () => {
      await new BookRepository(database).createAsync(createBookFixture())
      await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

      await database.dbAsync.run(
        `UPDATE chapters SET current_plan_version_id = ?, current_version_id = ? WHERE id = ?`,
        'plan-version-1',
        'rewrite-version-1',
        'chapter-1',
      )

      await new ChapterPlanRepository(database).createAsync(createChapterPlanFixture())
      await new ChapterDraftRepository(database).createAsync(createChapterDraftFixture())
      await new ChapterReviewRepository(database).createAsync(createReviewReportFixture())
      await new ChapterRewriteRepository(database).createAsync(createChapterRewriteFixture())
      await new ChapterOutputRepository(database).createAsync({
        id: 'output-1',
        bookId: 'book-1',
        chapterId: 'chapter-1',
        sourceType: 'rewrite',
        sourceId: 'rewrite-1',
        finalPath: 'completed/chapter-1.md',
        content: '最终章节正文',
        createdAt: '2026-04-06T00:20:00.000Z',
      })

      const view = loadDoctorChapterView(database, 'chapter-1')
      const asyncView = await loadDoctorChapterViewAsync(database, 'chapter-1')

      assert.equal(view.chapter.id, 'chapter-1')
      assert.equal(view.workflowChain.latestPlanId, 'plan-version-1')
      assert.equal(view.workflowChain.latestDraftId, 'draft-1')
      assert.equal(view.workflowChain.latestReviewId, 'review-1')
      assert.equal(view.workflowChain.latestRewriteId, 'rewrite-1')
      assert.equal(view.workflowChain.latestOutputId, 'output-1')
      assert.equal(view.workflowChain.currentPlanMatchesLatestPlan, true)
      assert.equal(view.workflowChain.currentVersionMatchesLatestDraft, false)
      assert.equal(view.workflowChain.currentVersionMatchesLatestRewrite, true)
      assert.equal((view.workflowChain.latestPlanLlm as any)?.selectedProvider, 'openai')
      assert.equal(asyncView.workflowChain.latestRewriteId, 'rewrite-1')

      assert.throws(() => loadDoctorChapterView(database, 'missing-chapter'), /Chapter not found/)
      await assert.rejects(() => loadDoctorChapterViewAsync(database, 'missing-chapter'), /Chapter not found/)
    })
  })
})