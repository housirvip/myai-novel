import type { LlmAdapter } from '../../shared/types/domain.js'
import { readLlmEnv } from '../../shared/utils/env.js'
import { OpenAiLlmAdapter } from './openai-adapter.js'

export function createLlmAdapter(): LlmAdapter | null {
  const env = readLlmEnv()

  if (!env.openAiApiKey) {
    return null
  }

  return new OpenAiLlmAdapter({
    apiKey: env.openAiApiKey,
    baseUrl: env.openAiBaseUrl,
    model: env.openAiModel,
  })
}
