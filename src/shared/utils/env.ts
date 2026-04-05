import dotenv from 'dotenv'

dotenv.config()

import type { LlmProvider, LlmTaskStage } from '../types/domain.js'

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

export type LlmStageConfig = {
  stage: LlmTaskStage
  provider: LlmProvider
  model: string
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

export function readLlmStageConfig(stage: LlmTaskStage, env: LlmEnvConfig = readLlmEnv()): LlmStageConfig {
  const provider = normalizeProvider(resolveStageProvider(stage) ?? env.provider)
  const model = resolveStageModel(stage, provider, env)

  return {
    stage,
    provider,
    model,
  }
}

function resolveStageProvider(stage: LlmTaskStage): string | undefined {
  return process.env[`LLM_${stage.toUpperCase()}_PROVIDER`]
}

function resolveStageModel(stage: LlmTaskStage, provider: LlmProvider, env: LlmEnvConfig): string {
  const override = process.env[`LLM_${stage.toUpperCase()}_MODEL`]

  if (override && override.trim().length > 0) {
    return override.trim()
  }

  return provider === 'openai-compatible' ? env.openAiCompatible.model : env.openAi.model
}

function normalizeProvider(value: string | undefined): LlmProvider {
  return value === 'openai-compatible' ? 'openai-compatible' : 'openai'
}
