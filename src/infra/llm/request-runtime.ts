import type { LlmProvider } from '../../shared/types/domain.js'
import { LlmRequestError, type LlmErrorCategory } from '../../shared/utils/errors.js'

type ExecuteResponsesRequestInput = {
  provider: LlmProvider
  url: string
  apiKey: string
  body: Record<string, unknown>
  timeoutMs: number
  maxRetries: number
}

export async function executeResponsesRequest<T>(input: ExecuteResponsesRequestInput): Promise<{
  payload: T
  requestId?: string
  latencyMs: number
  retryCount: number
}> {
  let attempt = 0
  let lastError: unknown

  while (attempt <= input.maxRetries) {
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

    try {
      const response = await fetch(input.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify(input.body),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        throw new LlmRequestError(
          `${input.provider} request failed: ${response.status} ${errorText}`,
          categoryFromStatus(response.status),
          {
            provider: input.provider,
            statusCode: response.status,
            retryable: isRetryableStatus(response.status),
          },
        )
      }

      const payload = (await response.json()) as T

      return {
        payload,
        requestId: response.headers.get('x-request-id') ?? response.headers.get('openai-request-id') ?? undefined,
        latencyMs: Date.now() - startedAt,
        retryCount: attempt,
      }
    } catch (error) {
      clearTimeout(timeout)

      const normalized = normalizeLlmError(error, input.provider, input.timeoutMs)
      lastError = normalized

      if (attempt >= input.maxRetries || !normalized.options.retryable) {
        throw normalized
      }

      await delay(Math.min(250 * 2 ** attempt, 1500))
      attempt += 1
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown LLM request failure')
}

function normalizeLlmError(error: unknown, provider: LlmProvider, timeoutMs: number): LlmRequestError {
  if (error instanceof LlmRequestError) {
    return error
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new LlmRequestError(
      `${provider} request timed out after ${timeoutMs}ms.`,
      'timeout',
      { provider, retryable: true, cause: error },
    )
  }

  if (error instanceof Error) {
    return new LlmRequestError(
      `${provider} request failed: ${error.message}`,
      'network',
      { provider, retryable: true, cause: error },
    )
  }

  return new LlmRequestError(
    `${provider} request failed with an unknown error.`,
    'unknown',
    { provider, retryable: false, cause: error },
  )
}

function categoryFromStatus(status: number): LlmErrorCategory {
  if (status === 401 || status === 403) {
    return 'auth'
  }

  if (status === 408) {
    return 'timeout'
  }

  if (status === 429) {
    return 'rate-limit'
  }

  if (status >= 500) {
    return 'server'
  }

  return 'client'
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}