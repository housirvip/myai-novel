import type { GenerateResult, LlmAdapter, PromptInput } from '../../shared/types/domain.js'

type OpenAiAdapterOptions = {
  apiKey: string
  baseUrl: string
  model: string
}

type ResponsesApiResponse = {
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

export class OpenAiLlmAdapter implements LlmAdapter {
  constructor(private readonly options: OpenAiAdapterOptions) {}

  async generateText(input: PromptInput): Promise<GenerateResult> {
    const response = await fetch(`${this.options.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
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
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
    }

    const payload = (await response.json()) as ResponsesApiResponse
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text ?? '')
      .join('\n')
      .trim()

    if (!text) {
      throw new Error('OpenAI response did not include text output')
    }

    return { text }
  }
}
