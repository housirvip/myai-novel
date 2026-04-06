/**
 * `NovelError` 是项目内部面向业务 / CLI 用户的统一错误类型。
 *
 * 当错误已经被归一成“用户可以直接理解并采取动作”的消息时，
 * 应优先抛出这个错误，而不是直接透传底层异常。
 */
export class NovelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NovelError'
  }
}

export type LlmErrorCategory = 'timeout' | 'rate-limit' | 'auth' | 'network' | 'server' | 'client' | 'invalid-response' | 'unknown'

/**
 * `LlmRequestError` 用于表达 LLM 网关层的执行错误。
 *
 * 它比普通 `Error` 多保存了：
 * - 错误分类
 * - HTTP 状态码
 * - 是否可重试
 * - provider 与原始 cause
 *
 * 这些信息会被 request runtime、factory、doctor 和测试共同消费。
 */
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

/**
 * 把未知错误对象收口为稳定字符串，避免日志与 CLI 输出里出现不可读值。
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
