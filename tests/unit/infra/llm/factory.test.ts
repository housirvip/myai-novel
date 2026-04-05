import assert from 'node:assert/strict'
import test from 'node:test'

import type { GenerateResult, PromptInput } from '../../../../src/shared/types/domain.js'
import { createLlmAdapter } from '../../../../src/infra/llm/factory.js'
import { OpenAiCompatibleLlmAdapter } from '../../../../src/infra/llm/openai-compatible-adapter.js'
import { OpenAiLlmAdapter } from '../../../../src/infra/llm/openai-adapter.js'
import { withEnv } from '../../../helpers/env.js'

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
  LLM_REVIEW_PROVIDER: undefined,
  LLM_REVIEW_MODEL: undefined,
  LLM_REVIEW_TIMEOUT_MS: undefined,
  LLM_REVIEW_MAX_RETRIES: undefined,
} satisfies Record<string, string | undefined>

function createStubResult(input: PromptInput, provider: 'openai' | 'openai-compatible', model: string): GenerateResult {
  return {
    text: `${provider}:${model}:${input.user}`,
    provider,
    model,
    responseId: `${provider}-response-id`,
    latencyMs: 12,
    metadata: {
      stage: input.metadata?.stage,
      selectedProvider: provider,
      providerSource: 'default-provider',
      selectedModel: model,
      modelSource: input.metadata?.modelHint ? 'input-hint' : 'provider-default',
      fallbackUsed: false,
      requestId: `${provider}-request-id`,
      retryCount: 0,
      timeoutMs: input.metadata?.timeoutMs,
      maxRetries: input.metadata?.maxRetries,
      traceId: input.metadata?.traceId,
    },
  }
}

async function withPatchedGenerateText<T>(
  ctor: { prototype: { generateText: (input: PromptInput) => Promise<GenerateResult> } },
  implementation: (input: PromptInput) => Promise<GenerateResult>,
  run: () => T | Promise<T>,
): Promise<T> {
  const original = ctor.prototype.generateText
  ctor.prototype.generateText = implementation

  try {
    return await run()
  } finally {
    ctor.prototype.generateText = original
  }
}

test('createLlmAdapter returns null when no provider is configured with an API key', async () => {
  await withEnv(resetLlmEnv, () => {
    assert.equal(createLlmAdapter(), null)
  })
})

test('createLlmAdapter uses stage routing metadata when a stage-specific provider is configured', async () => {
  const calls: PromptInput[] = []

  await withEnv(
    {
      ...resetLlmEnv,
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: 'openai-default',
      OPENAI_COMPATIBLE_API_KEY: 'compat-key',
      OPENAI_COMPATIBLE_MODEL: 'compat-default',
      LLM_REVIEW_PROVIDER: 'openai-compatible',
      LLM_REVIEW_MODEL: 'review-router-model',
      LLM_REVIEW_TIMEOUT_MS: '9000',
      LLM_REVIEW_MAX_RETRIES: '4',
    },
    async () => {
      await withPatchedGenerateText(
        OpenAiCompatibleLlmAdapter,
        async (input) => {
          calls.push(input)
          return createStubResult(input, 'openai-compatible', input.metadata?.modelHint ?? 'compat-default')
        },
        async () => {
          const adapter = createLlmAdapter()
          assert.ok(adapter)

          const result = await adapter.generateText({
            user: 'review me',
            metadata: { stage: 'review' },
          })

          assert.equal(calls.length, 1)
          assert.equal(calls[0]?.metadata?.providerHint, 'openai-compatible')
          assert.equal(calls[0]?.metadata?.modelHint, 'review-router-model')
          assert.equal(calls[0]?.metadata?.timeoutMs, 9000)
          assert.equal(calls[0]?.metadata?.maxRetries, 4)
          assert.equal(result.provider, 'openai-compatible')
          assert.equal(result.model, 'review-router-model')
          assert.equal(result.metadata?.providerSource, 'stage-routing')
          assert.equal(result.metadata?.modelSource, 'stage-routing')
          assert.equal(result.metadata?.fallbackUsed, false)
          assert.equal(result.metadata?.providerAttemptCount, 1)
        },
      )
    },
  )
})

test('createLlmAdapter falls back to an available provider when the requested provider is not configured', async () => {
  await withEnv(
    {
      ...resetLlmEnv,
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: 'openai-default',
      OPENAI_COMPATIBLE_API_KEY: '',
    },
    async () => {
      await withPatchedGenerateText(
        OpenAiLlmAdapter,
        async (input) => createStubResult(input, 'openai', input.metadata?.modelHint ?? 'openai-default'),
        async () => {
          const adapter = createLlmAdapter()
          assert.ok(adapter)

          const result = await adapter.generateText({
            user: 'fallback me',
            metadata: {
              providerHint: 'openai-compatible',
              modelHint: 'requested-compatible-model',
            },
          })

          assert.equal(result.provider, 'openai')
          assert.equal(result.model, 'openai-default')
          assert.equal(result.metadata?.providerSource, 'fallback')
          assert.equal(result.metadata?.modelSource, 'provider-default')
          assert.equal(result.metadata?.fallbackUsed, true)
          assert.equal(result.metadata?.fallbackFromProvider, 'openai-compatible')
          assert.equal(result.metadata?.providerAttemptCount, 1)
        },
      )
    },
  )
})

test('createLlmAdapter retries the next configured provider after an adapter failure', async () => {
  let compatibleAttempts = 0
  let openAiAttempts = 0

  await withEnv(
    {
      ...resetLlmEnv,
      OPENAI_API_KEY: 'openai-key',
      OPENAI_MODEL: 'openai-default',
      OPENAI_COMPATIBLE_API_KEY: 'compat-key',
      OPENAI_COMPATIBLE_MODEL: 'compat-default',
    },
    async () => {
      await withPatchedGenerateText(OpenAiCompatibleLlmAdapter, async () => {
        compatibleAttempts += 1
        throw new Error('compatible provider failed')
      }, async () => {
        await withPatchedGenerateText(
          OpenAiLlmAdapter,
          async (input) => {
            openAiAttempts += 1
            return createStubResult(input, 'openai', input.metadata?.modelHint ?? 'openai-default')
          },
          async () => {
            const adapter = createLlmAdapter()
            assert.ok(adapter)

            const result = await adapter.generateText({
              user: 'fallback after failure',
              metadata: { providerHint: 'openai-compatible' },
            })

            assert.equal(compatibleAttempts, 1)
            assert.equal(openAiAttempts, 1)
            assert.equal(result.provider, 'openai')
            assert.equal(result.metadata?.providerSource, 'fallback')
            assert.equal(result.metadata?.fallbackUsed, true)
            assert.equal(result.metadata?.fallbackFromProvider, 'openai-compatible')
            assert.equal(result.metadata?.providerAttemptCount, 2)
          },
        )
      })
    },
  )
})