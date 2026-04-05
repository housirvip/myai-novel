import assert from 'node:assert/strict'
import test from 'node:test'

import { LlmRequestError } from '../../../../src/shared/utils/errors.js'
import { executeResponsesRequest } from '../../../../src/infra/llm/request-runtime.js'
import { withMockFetch } from '../../../helpers/fetch.js'

test('executeResponsesRequest returns payload, request id and retry count on success', async () => {
  let calls = 0

  await withMockFetch(
    (async () => {
      calls += 1
      return new Response(JSON.stringify({ output: 'ok' }), {
        status: 200,
        headers: { 'x-request-id': 'req-1' },
      })
    }) as typeof fetch,
    async () => {
      const result = await executeResponsesRequest<{ output: string }>({
        provider: 'openai',
        url: 'https://example.test/responses',
        apiKey: 'test-key',
        body: { prompt: 'hello' },
        timeoutMs: 100,
        maxRetries: 0,
      })

      assert.equal(calls, 1)
      assert.deepEqual(result.payload, { output: 'ok' })
      assert.equal(result.requestId, 'req-1')
      assert.equal(result.retryCount, 0)
      assert.equal(typeof result.latencyMs, 'number')
    },
  )
})

test('executeResponsesRequest maps non-retryable auth failures without retrying', async () => {
  let calls = 0

  await withMockFetch(
    (async () => {
      calls += 1
      return new Response('forbidden', { status: 401 })
    }) as typeof fetch,
    async () => {
      await assert.rejects(
        () =>
          executeResponsesRequest({
            provider: 'openai-compatible',
            url: 'https://example.test/responses',
            apiKey: 'test-key',
            body: { prompt: 'hello' },
            timeoutMs: 100,
            maxRetries: 2,
          }),
        (error: unknown) => {
          assert.equal(calls, 1)
          assert.ok(error instanceof LlmRequestError)
          assert.equal(error.category, 'auth')
          assert.equal(error.options.retryable, false)
          assert.equal(error.options.statusCode, 401)
          return true
        },
      )
    },
  )
})

test('executeResponsesRequest retries retryable status codes and returns the eventual success result', async () => {
  let calls = 0

  await withMockFetch(
    (async () => {
      calls += 1

      if (calls === 1) {
        return new Response('slow down', { status: 429 })
      }

      return new Response(JSON.stringify({ output: 'recovered' }), {
        status: 200,
        headers: { 'openai-request-id': 'req-2' },
      })
    }) as typeof fetch,
    async () => {
      const result = await executeResponsesRequest<{ output: string }>({
        provider: 'openai',
        url: 'https://example.test/responses',
        apiKey: 'test-key',
        body: { prompt: 'hello' },
        timeoutMs: 100,
        maxRetries: 1,
      })

      assert.equal(calls, 2)
      assert.deepEqual(result.payload, { output: 'recovered' })
      assert.equal(result.requestId, 'req-2')
      assert.equal(result.retryCount, 1)
    },
  )
})

test('executeResponsesRequest normalizes aborted requests into timeout errors', async () => {
  await withMockFetch(
    ((_: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })) as typeof fetch,
    async () => {
      await assert.rejects(
        () =>
          executeResponsesRequest({
            provider: 'openai-compatible',
            url: 'https://example.test/responses',
            apiKey: 'test-key',
            body: { prompt: 'hello' },
            timeoutMs: 20,
            maxRetries: 0,
          }),
        (error: unknown) => {
          assert.ok(error instanceof LlmRequestError)
          assert.equal(error.category, 'timeout')
          assert.equal(error.options.retryable, true)
          assert.equal(error.options.provider, 'openai-compatible')
          return true
        },
      )
    },
  )
})