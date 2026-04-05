import assert from 'node:assert/strict'
import test from 'node:test'

import { loadDoctorBootstrapView } from '../../../../src/cli/commands/doctor/services.js'
import { ensureProjectDirectories, resolveProjectPaths, writeProjectConfig } from '../../../../src/shared/utils/project-paths.js'
import { withEnv } from '../../../helpers/env.js'
import { withTempDir } from '../../../helpers/fs.js'
import { withCwd } from '../../../helpers/process.js'

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