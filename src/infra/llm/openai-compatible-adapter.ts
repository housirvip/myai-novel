import type { GenerateResult, LlmAdapter, PromptInput } from '../../shared/types/domain.js'

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

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  readonly provider = 'openai-compatible' as const

  constructor(private readonly options: OpenAiCompatibleAdapterOptions) {}

  async generateText(input: PromptInput): Promise<GenerateResult> {
    const startedAt = Date.now()
    const response = await fetch(`${this.options.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
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
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI-compatible request failed: ${response.status} ${errorText}`)
    }

    const payload = (await response.json()) as CompatibleResponsesApiResponse
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('\n')
      .trim()

    if (!text) {
      throw new Error('OpenAI-compatible response did not include text output')
    }

    return {
      text,
      provider: this.provider,
      model: input.metadata?.modelHint ?? this.options.model,
      responseId: payload.id,
      latencyMs: Date.now() - startedAt,
      metadata: {
        selectedProvider: this.provider,
        providerSource: 'default-provider',
        selectedModel: input.metadata?.modelHint ?? this.options.model,
        modelSource: input.metadata?.modelHint ? 'input-hint' : 'provider-default',
        fallbackUsed: false,
        requestId: response.headers.get('x-request-id') ?? response.headers.get('openai-request-id') ?? undefined,
        finishReason: payload.status,
        rawUsage: payload.usage,
        latencyMs: Date.now() - startedAt,
      },
    }
  }
}
