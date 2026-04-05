import assert from 'node:assert/strict'
import test from 'node:test'

import { LlmRequestError, NovelError, toErrorMessage } from '../../../src/shared/utils/errors.js'

test('NovelError exposes a stable error name', () => {
  const error = new NovelError('boom')

  assert.equal(error.name, 'NovelError')
  assert.equal(error.message, 'boom')
})

test('LlmRequestError preserves category and diagnostic options', () => {
  const cause = new Error('rate limited')
  const error = new LlmRequestError('request failed', 'rate-limit', {
    provider: 'openai-compatible',
    statusCode: 429,
    retryable: true,
    cause,
  })

  assert.equal(error.name, 'LlmRequestError')
  assert.equal(error.category, 'rate-limit')
  assert.equal(error.options.provider, 'openai-compatible')
  assert.equal(error.options.statusCode, 429)
  assert.equal(error.options.retryable, true)
  assert.equal(error.options.cause, cause)
})

test('toErrorMessage normalizes unknown values safely', () => {
  assert.equal(toErrorMessage(new Error('typed failure')), 'typed failure')
  assert.equal(toErrorMessage('string failure'), 'Unknown error')
  assert.equal(toErrorMessage(null), 'Unknown error')
})