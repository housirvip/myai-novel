import assert from 'node:assert/strict'
import test from 'node:test'

import { readLlmEnv, readLlmStageConfig } from '../../../src/shared/utils/env.js'
import { withEnv } from '../../helpers/env.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  LLM_TIMEOUT_MS: undefined,
  LLM_MAX_RETRIES: undefined,
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
  LLM_PLANNING_TIMEOUT_MS: undefined,
  LLM_PLANNING_MAX_RETRIES: undefined,
  LLM_GENERATION_PROVIDER: undefined,
  LLM_GENERATION_MODEL: undefined,
  LLM_GENERATION_TIMEOUT_MS: undefined,
  LLM_GENERATION_MAX_RETRIES: undefined,
  LLM_REVIEW_PROVIDER: undefined,
  LLM_REVIEW_MODEL: undefined,
  LLM_REVIEW_TIMEOUT_MS: undefined,
  LLM_REVIEW_MAX_RETRIES: undefined,
  LLM_REWRITE_PROVIDER: undefined,
  LLM_REWRITE_MODEL: undefined,
  LLM_REWRITE_TIMEOUT_MS: undefined,
  LLM_REWRITE_MAX_RETRIES: undefined,
  LLM_GENERAL_PROVIDER: undefined,
  LLM_GENERAL_MODEL: undefined,
  LLM_GENERAL_TIMEOUT_MS: undefined,
  LLM_GENERAL_MAX_RETRIES: undefined,
} satisfies Record<string, string | undefined>

test('readLlmEnv returns stable defaults when no env overrides are provided', async () => {
  await withEnv(resetLlmEnv, () => {
    const env = readLlmEnv()

    assert.equal(env.provider, 'openai')
    assert.equal(env.defaultModel, 'gpt-5')
    assert.equal(env.openAi.baseUrl, 'https://api.openai.com/v1')
    assert.equal(env.openAi.model, 'gpt-5')
    assert.equal(env.openAi.timeoutMs, 60000)
    assert.equal(env.openAi.maxRetries, 1)
    assert.equal(env.openAiCompatible.apiKey, undefined)
    assert.equal(env.openAiCompatible.baseUrl, 'https://api.openai.com/v1')
    assert.equal(env.openAiCompatible.model, 'gpt-5')
    assert.equal(env.openAiCompatible.timeoutMs, 60000)
    assert.equal(env.openAiCompatible.maxRetries, 1)
  })
})

test('readLlmEnv supports provider-specific overrides and compatible fallback values', async () => {
  await withEnv(
    {
      ...resetLlmEnv,
      LLM_PROVIDER: 'openai-compatible',
      LLM_TIMEOUT_MS: '45000',
      LLM_MAX_RETRIES: '3',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_BASE_URL: 'https://openai.example/v1',
      OPENAI_MODEL: 'gpt-openai',
      OPENAI_COMPATIBLE_BASE_URL: 'https://router.example/v1',
      OPENAI_COMPATIBLE_MODEL: 'gpt-router',
    },
    () => {
      const env = readLlmEnv()

      assert.equal(env.provider, 'openai-compatible')
      assert.equal(env.defaultModel, 'gpt-router')
      assert.equal(env.openAi.apiKey, 'openai-key')
      assert.equal(env.openAi.timeoutMs, 45000)
      assert.equal(env.openAi.maxRetries, 3)
      assert.equal(env.openAiCompatible.apiKey, 'openai-key')
      assert.equal(env.openAiCompatible.baseUrl, 'https://router.example/v1')
      assert.equal(env.openAiCompatible.model, 'gpt-router')
      assert.equal(env.openAiCompatible.timeoutMs, 45000)
      assert.equal(env.openAiCompatible.maxRetries, 3)
    },
  )
})

test('readLlmStageConfig respects stage overrides for provider, model, timeout and retries', async () => {
  await withEnv(
    {
      ...resetLlmEnv,
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: 'gpt-openai',
      OPENAI_TIMEOUT_MS: '12000',
      OPENAI_MAX_RETRIES: '1',
      OPENAI_COMPATIBLE_API_KEY: 'compat-key',
      OPENAI_COMPATIBLE_MODEL: 'gpt-compat',
      OPENAI_COMPATIBLE_TIMEOUT_MS: '33000',
      OPENAI_COMPATIBLE_MAX_RETRIES: '2',
      LLM_REVIEW_PROVIDER: 'openai-compatible',
      LLM_REVIEW_MODEL: 'review-model',
      LLM_REVIEW_TIMEOUT_MS: '9000',
      LLM_REVIEW_MAX_RETRIES: '4',
    },
    () => {
      const env = readLlmEnv()
      const config = readLlmStageConfig('review', env)

      assert.deepEqual(config, {
        stage: 'review',
        provider: 'openai-compatible',
        model: 'review-model',
        timeoutMs: 9000,
        maxRetries: 4,
      })
    },
  )
})

test('invalid timeout and retry env values fall back to safe defaults', async () => {
  await withEnv(
    {
      ...resetLlmEnv,
      LLM_TIMEOUT_MS: 'not-a-number',
      LLM_MAX_RETRIES: '-3',
      OPENAI_TIMEOUT_MS: '0',
      OPENAI_MAX_RETRIES: '-1',
      OPENAI_COMPATIBLE_TIMEOUT_MS: 'NaN',
      OPENAI_COMPATIBLE_MAX_RETRIES: '-8',
      LLM_REWRITE_TIMEOUT_MS: '-9',
      LLM_REWRITE_MAX_RETRIES: 'oops',
    },
    () => {
      const env = readLlmEnv()
      const rewriteConfig = readLlmStageConfig('rewrite', env)

      assert.equal(env.openAi.timeoutMs, 60000)
      assert.equal(env.openAi.maxRetries, 1)
      assert.equal(env.openAiCompatible.timeoutMs, 60000)
      assert.equal(env.openAiCompatible.maxRetries, 1)
      assert.equal(rewriteConfig.timeoutMs, 60000)
      assert.equal(rewriteConfig.maxRetries, 1)
    },
  )
})