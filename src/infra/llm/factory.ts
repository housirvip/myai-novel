import type { LlmAdapter } from '../../shared/types/domain.js'
import { readLlmEnv } from '../../shared/utils/env.js'
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-adapter.js'
import { OpenAiLlmAdapter } from './openai-adapter.js'

export function createLlmAdapter(): LlmAdapter | null {
  const env = readLlmEnv()

  if (env.provider === 'openai-compatible') {
    if (!env.openAiCompatible.apiKey) {
      return null
    }

    return new OpenAiCompatibleLlmAdapter({
      apiKey: env.openAiCompatible.apiKey,
      baseUrl: env.openAiCompatible.baseUrl,
      model: env.openAiCompatible.model,
    })
  }

  if (!env.openAi.apiKey) {
    return null
  }

  return new OpenAiLlmAdapter({
    apiKey: env.openAi.apiKey,
    baseUrl: env.openAi.baseUrl,
    model: env.openAi.model,
  })
}
