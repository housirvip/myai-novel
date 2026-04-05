import dotenv from 'dotenv'

dotenv.config()

import type { LlmProvider } from '../types/domain.js'

export type LlmProviderConfig = {
  provider: LlmProvider
  apiKey?: string
  baseUrl: string
  model: string
}

export type LlmEnvConfig = {
  provider: LlmProvider
  defaultModel: string
  openAi: LlmProviderConfig
  openAiCompatible: LlmProviderConfig
}

export function readLlmEnv(): LlmEnvConfig {
  const provider = normalizeProvider(process.env.LLM_PROVIDER)
  const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-5'
  const openAiCompatibleModel = process.env.OPENAI_COMPATIBLE_MODEL ?? openAiModel

  return {
    provider,
    defaultModel: provider === 'openai-compatible' ? openAiCompatibleModel : openAiModel,
    openAi: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: openAiModel,
    },
    openAiCompatible: {
      provider: 'openai-compatible',
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: openAiCompatibleModel,
    },
  }
}

function normalizeProvider(value: string | undefined): LlmProvider {
  return value === 'openai-compatible' ? 'openai-compatible' : 'openai'
}
