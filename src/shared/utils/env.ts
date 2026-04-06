import dotenv from 'dotenv'

dotenv.config()

import type { LlmProvider, LlmTaskStage } from '../types/domain.js'

/**
 * 本文件负责把环境变量解析成项目内部统一使用的 LLM 配置真源。
 *
 * 它的核心职责不是“简单读 env”，而是把以下语义稳定下来：
 * - 默认 provider / model 是什么
 * - provider 级 timeout / retry 默认值如何继承
 * - stage routing 是否覆盖默认 provider / model
 * - 非法数值输入如何安全回退
 */

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

/**
 * 读取当前进程环境中的 LLM 全局配置。
 *
 * 这里返回的是 provider 级真源，而不是某次请求的最终执行配置；
 * 真正落到某个 stage 时，还会再经过 `readLlmStageConfig()` 做路由覆盖。
 */
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

/**
 * 读取某个 stage 的最终执行配置。
 *
 * 优先级是：
 * - 先看该 stage 是否配置专属 provider
 * - 再决定该 provider 下最终使用的 model
 * - timeout / retry 则优先吃 stage override，否则退回 provider 默认值
 */
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

/**
 * 解析必须大于 `0` 的整数配置。
 *
 * 无效输入不会抛错，而是直接回退到调用方提供的安全默认值，
 * 这是 env 解析层故意保留的容错语义。
 */
function parsePositiveInteger(value: string | undefined, fallbackValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue
}

/**
 * 解析允许为 `0` 的非负整数配置，例如 max retries。
 */
function parseNonNegativeInteger(value: string | undefined, fallbackValue: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackValue
}
