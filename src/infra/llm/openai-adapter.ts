import type { GenerateResult, LlmAdapter, PromptInput } from '../../shared/types/domain.js'
import { LlmRequestError } from '../../shared/utils/errors.js'
import { executeResponsesRequest } from './request-runtime.js'

type OpenAiAdapterOptions = {
  apiKey: string
  baseUrl: string
  model: string
}

type ResponsesApiResponse = {
  id?: string
  status?: string
  usage?: Record<string, unknown>
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

/**
 * OpenAI 官方 responses API 适配器。
 *
 * 它的职责是把项目内部统一的 `PromptInput` 转成 OpenAI `/responses` 请求，
 * 并把返回值收敛成项目统一的 `GenerateResult` 结构。
 */
export class OpenAiLlmAdapter implements LlmAdapter {
  readonly provider = 'openai' as const

  constructor(private readonly options: OpenAiAdapterOptions) {}

  /**
   * 执行一次 OpenAI 文本生成。
   *
   * 如果响应里没有可提取的文本内容，这里会抛出 `invalid-response`，
   * 交由上层 factory 决定是否 fallback 到其他 provider。
   */
  async generateText(input: PromptInput): Promise<GenerateResult> {
    const timeoutMs = input.metadata?.timeoutMs ?? 60000
    const maxRetries = input.metadata?.maxRetries ?? 1
    const request = await executeResponsesRequest<ResponsesApiResponse>({
      provider: this.provider,
      url: `${this.options.baseUrl}/responses`,
      apiKey: this.options.apiKey,
      timeoutMs,
      maxRetries,
      body: {
        model: input.metadata?.modelHint ?? this.options.model,
        input: [
          ...(input.system
            ? [
                {
                  role: 'system',
                  content: input.system,
                },
              ]
            : []),
          {
            role: 'user',
            content: input.user,
          },
        ],
      },
    })
    const payload = request.payload
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('\n')
      .trim()

    if (!text) {
      throw new LlmRequestError('OpenAI response did not include text output', 'invalid-response', {
        provider: this.provider,
        retryable: false,
      })
    }

    return {
      text,
      provider: this.provider,
      model: input.metadata?.modelHint ?? this.options.model,
      responseId: payload.id,
      latencyMs: request.latencyMs,
      metadata: {
        stage: input.metadata?.stage,
        selectedProvider: this.provider,
        providerSource: 'default-provider',
        selectedModel: input.metadata?.modelHint ?? this.options.model,
        modelSource: input.metadata?.modelHint ? 'input-hint' : 'provider-default',
        fallbackUsed: false,
        requestId: request.requestId,
        finishReason: payload.status,
        rawUsage: payload.usage,
        latencyMs: request.latencyMs,
        retryCount: request.retryCount,
        timeoutMs,
        maxRetries,
        traceId: input.metadata?.traceId,
      },
    }
  }
}
