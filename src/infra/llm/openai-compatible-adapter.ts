import type { GenerateResult, LlmAdapter, PromptInput } from '../../shared/types/domain.js'
import { LlmRequestError } from '../../shared/utils/errors.js'
import { executeResponsesRequest } from './request-runtime.js'

type OpenAiCompatibleAdapterOptions = {
  apiKey: string
  baseUrl: string
  model: string
}

type CompatibleResponsesApiResponse = {
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
 * OpenAI-compatible responses API 适配器。
 *
 * 这个适配器和 `OpenAiLlmAdapter` 共享统一输入输出协议，
 * 但允许把请求发往兼容 OpenAI 接口的第三方 provider。
 */
export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  readonly provider = 'openai-compatible' as const

  constructor(private readonly options: OpenAiCompatibleAdapterOptions) {}

  /**
   * 执行一次兼容 OpenAI 协议的文本生成。
   */
  async generateText(input: PromptInput): Promise<GenerateResult> {
    const timeoutMs = input.metadata?.timeoutMs ?? 60000
    const maxRetries = input.metadata?.maxRetries ?? 1
    const request = await executeResponsesRequest<CompatibleResponsesApiResponse>({
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
      throw new LlmRequestError('OpenAI-compatible response did not include text output', 'invalid-response', {
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
