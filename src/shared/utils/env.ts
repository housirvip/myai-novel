import dotenv from 'dotenv'

dotenv.config()

import type { LlmProvider, LlmTaskStage } from '../types/domain.js'

export type LlmProviderConfig = {
  provider: LlmProvider
  apiKey?: string
  baseUrl: string
  model: string
  timeoutMs: number
  maxRetries: number
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
  timeoutMs: number
  maxRetries: number
}

export function readLlmEnv(): LlmEnvConfig {
  const provider = normalizeProvider(process.env.LLM_PROVIDER)
  const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-5'
  const openAiCompatibleModel = process.env.OPENAI_COMPATIBLE_MODEL ?? openAiModel
  const defaultTimeoutMs = parsePositiveInteger(process.env.LLM_TIMEOUT_MS, 60000)
  const defaultMaxRetries = parseNonNegativeInteger(process.env.LLM_MAX_RETRIES, 1)

  return {
    provider,
    defaultModel: provider === 'openai-compatible' ? openAiCompatibleModel : openAiModel,
    openAi: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: openAiModel,
      timeoutMs: parsePositiveInteger(process.env.OPENAI_TIMEOUT_MS, defaultTimeoutMs),
      maxRetries: parseNonNegativeInteger(process.env.OPENAI_MAX_RETRIES, defaultMaxRetries),
    },
    openAiCompatible: {
      provider: 'openai-compatible',
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: openAiCompatibleModel,
      timeoutMs: parsePositiveInteger(process.env.OPENAI_COMPATIBLE_TIMEOUT_MS, defaultTimeoutMs),
      maxRetries: parseNonNegativeInteger(process.env.OPENAI_COMPATIBLE_MAX_RETRIES, defaultMaxRetries),
    },
  }
}

export function readLlmStageConfig(stage: LlmTaskStage, env: LlmEnvConfig = readLlmEnv()): LlmStageConfig {
  const provider = normalizeProvider(resolveStageProvider(stage) ?? env.provider)
  const model = resolveStageModel(stage, provider, env)
  const providerConfig = provider === 'openai-compatible' ? env.openAiCompatible : env.openAi

  return {
    stage,
    provider,
    model,
    timeoutMs: resolveStageTimeoutMs(stage, providerConfig.timeoutMs),
    maxRetries: resolveStageMaxRetries(stage, providerConfig.maxRetries),
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

function resolveStageTimeoutMs(stage: LlmTaskStage, fallbackValue: number): number {
  return parsePositiveInteger(process.env[`LLM_${stage.toUpperCase()}_TIMEOUT_MS`], fallbackValue)
}

function resolveStageMaxRetries(stage: LlmTaskStage, fallbackValue: number): number {
  return parseNonNegativeInteger(process.env[`LLM_${stage.toUpperCase()}_MAX_RETRIES`], fallbackValue)
}

function normalizeProvider(value: string | undefined): LlmProvider {
  return value === 'openai-compatible' ? 'openai-compatible' : 'openai'
}

function parsePositiveInteger(value: string | undefined, fallbackValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue
}

function parseNonNegativeInteger(value: string | undefined, fallbackValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackValue
}
