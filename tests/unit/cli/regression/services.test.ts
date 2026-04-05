import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { executeRegressionCase } from '../../../../src/cli/commands/regression/services.js'
import { withEnv } from '../../../helpers/env.js'
import { withTempDir } from '../../../helpers/fs.js'
import { withCwd } from '../../../helpers/process.js'

const resetRegressionEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
  LLM_PLANNING_PROVIDER: undefined,
  LLM_REVIEW_PROVIDER: undefined,
  LLM_REVIEW_MODEL: undefined,
  LLM_REWRITE_PROVIDER: undefined,
} satisfies Record<string, string | undefined>

test('executeRegressionCase returns unknown-case for unregistered case names', async () => {
  const result = await executeRegressionCase(null, 'totally-unknown-case')

  assert.equal(result.known, false)
  assert.equal(result.status, 'unknown-case')
  assert.match(result.summary, /Unknown regression case/)
  assert.equal(result.steps[0]?.name, 'resolve-case')
})

test('llm-provider-smoke warns when the default provider has no credentials', async () => {
  await withTempDir(async (rootDir) => {
    await withCwd(rootDir, async () => {
      await withEnv(resetRegressionEnv, async () => {
        const result = await executeRegressionCase(null, 'llm-provider-smoke')

        assert.equal(result.known, true)
        assert.equal(result.status, 'warning')
        assert.match(result.summary, /not fully configured/i)
        assert.equal(result.steps[1]?.name, 'check-provider-credentials')
        assert.equal(result.steps[1]?.status, 'fail')
        assert.equal(result.artifacts[0]?.status, 'missing')
      })
    })
  })
})

test('secondary-provider-smoke passes when the secondary provider is configured and routed by a stage', async () => {
  await withTempDir(async (rootDir) => {
    await withCwd(rootDir, async () => {
      await withEnv(
        {
          ...resetRegressionEnv,
          LLM_PROVIDER: 'openai',
          OPENAI_API_KEY: 'openai-key',
          OPENAI_MODEL: 'gpt-openai',
          OPENAI_COMPATIBLE_API_KEY: 'compat-key',
          OPENAI_COMPATIBLE_MODEL: 'gpt-compat',
          LLM_REVIEW_PROVIDER: 'openai-compatible',
          LLM_REVIEW_MODEL: 'review-router-model',
        },
        async () => {
          const result = await executeRegressionCase(null, 'secondary-provider-smoke')

          assert.equal(result.status, 'pass')
          assert.match(result.summary, /Secondary provider is configured/i)
          assert.equal(result.steps[1]?.status, 'pass')
          assert.match(result.steps[2]?.detail ?? '', /review/)
        },
      )
    })
  })
})

test('database-backend-smoke reports missing prerequisites when no project config exists', async () => {
  await withTempDir(async (rootDir) => {
    await withCwd(rootDir, async () => {
      const result = await executeRegressionCase(null, 'database-backend-smoke')

      assert.equal(result.status, 'missing-prerequisite')
      assert.match(result.summary, /Project database config is missing/i)
      assert.equal(result.artifacts[0]?.status, 'missing')
    })
  })
})

test('mixed-config-validation reports both provider routing and database config issues', async () => {
  await withTempDir(async (rootDir) => {
    const configDir = path.join(rootDir, 'config')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      path.join(configDir, 'database.json'),
      JSON.stringify(
        {
          database: {
            client: 'mysql',
            host: '127.0.0.1',
            user: 'novel',
            database: 'novel_db',
          },
        },
        null,
        2,
      ),
      'utf8',
    )

    await withCwd(rootDir, async () => {
      await withEnv(
        {
          ...resetRegressionEnv,
          LLM_PROVIDER: 'openai',
          LLM_REVIEW_PROVIDER: 'openai-compatible',
          LLM_REVIEW_MODEL: 'review-router-model',
        },
        async () => {
          const result = await executeRegressionCase(null, 'mixed-config-validation')

          assert.equal(result.status, 'warning')
          assert.match(result.summary, /Detected \d+ mixed configuration issue/)
          assert.equal(result.steps[0]?.status, 'fail')
          assert.equal(result.steps[1]?.status, 'fail')
          assert.equal(result.steps[2]?.status, 'fail')
          assert.equal(result.artifacts[0]?.status, 'missing')
          assert.equal(result.artifacts[1]?.status, 'missing')
        },
      )
    })
  })
})