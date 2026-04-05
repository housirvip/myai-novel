export class NovelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NovelError'
  }
}

export type LlmErrorCategory = 'timeout' | 'rate-limit' | 'auth' | 'network' | 'server' | 'client' | 'invalid-response' | 'unknown'

export class LlmRequestError extends Error {
  constructor(
    message: string,
    readonly category: LlmErrorCategory,
    readonly options: {
      provider?: string
      statusCode?: number
      retryable?: boolean
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'LlmRequestError'
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
