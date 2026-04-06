import type {
  GenerateResult,
  LlmAdapter,
  LlmExecutionMetadata,
  LlmModelSource,
  LlmProvider,
  LlmResolutionSource,
  LlmTaskStage,
  PromptInput,
} from '../../shared/types/domain.js'
import { readLlmEnv, readLlmStageConfig, type LlmEnvConfig } from '../../shared/utils/env.js'
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-adapter.js'
import { OpenAiLlmAdapter } from './openai-adapter.js'

/**
 * 创建当前项目使用的统一 LLM 入口。
 *
 * 这里的目标不是简单返回某个 provider adapter，
 * 而是构造一个具备以下能力的“路由层”适配器：
 * - 按 stage routing 或 input hint 选择 provider
 * - 在 provider 不可用或执行失败时尝试 fallback provider
 * - 为最终结果补齐统一的 `LlmExecutionMetadata`
 */
export function createLlmAdapter(): LlmAdapter | null {
  const env = readLlmEnv()
  const registry = createProviderRegistry(env)

  if (Object.keys(registry).length === 0) {
    return null
  }

  return new RoutedLlmAdapter(env, registry)
}

/**
 * `RoutedLlmAdapter` 是项目内部真正使用的 LLM 门面。
 *
 * 它把“请求想用哪个 provider”与“最终实际用了哪个 provider / model”分离开来，
 * 从而支持 stage routing、fallback、统一 metadata 和 provider 尝试次数统计。
 */
class RoutedLlmAdapter implements LlmAdapter {
  readonly provider: LlmProvider

  constructor(
    private readonly env: LlmEnvConfig,
    private readonly registry: Partial<Record<LlmProvider, LlmAdapter>>,
  ) {
    this.provider = env.provider
  }

  /**
   * 执行一次带 provider 路由和 fallback 的文本生成请求。
   *
   * 流程是：
   * 1. 先解析本次请求“理论上应该使用”的 provider
   * 2. 再构造直接 provider + fallback provider 的尝试序列
   * 3. 每次尝试都为底层 adapter 补齐 model / timeout / retry / trace metadata
   * 4. 成功后统一回填 `LlmExecutionMetadata`
   */
  async generateText(input: PromptInput): Promise<GenerateResult> {
    const providerResolution = resolveRequestedProvider(input, this.env)
    const adapterAttempts = this.pickAdapterAttempts(providerResolution.provider)

    if (adapterAttempts.length === 0) {
      throw new Error('No configured LLM provider is available for this request.')
    }

    let lastError: unknown

    for (let index = 0; index < adapterAttempts.length; index += 1) {
      const attempt = adapterAttempts[index]
      const selectedProvider = attempt.provider
      const stageConfig = resolveStageExecutionConfig(input.metadata?.stage, selectedProvider, this.env)
      const modelResolution = resolveSelectedModel(input, selectedProvider, this.env, providerResolution.provider)
      const selectedModel = modelResolution.model

      try {
        const result = await attempt.adapter.generateText({
          ...input,
          metadata: {
            ...input.metadata,
            providerHint: selectedProvider,
            modelHint: selectedModel,
            timeoutMs: input.metadata?.timeoutMs ?? stageConfig.timeoutMs,
            maxRetries: input.metadata?.maxRetries ?? stageConfig.maxRetries,
            traceId: input.metadata?.traceId ?? `${input.metadata?.stage ?? 'general'}:${Date.now()}`,
          },
        })

        return buildUnifiedResult({
          input,
          result,
          providerResolution,
          selectedProvider,
          selectedModel,
          modelResolution,
          fallbackFromProvider: attempt.fallbackFromProvider,
          providerAttemptCount: index + 1,
        })
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No configured LLM provider is available for this request.')
  }

  private pickAdapterAttempts(requestedProvider: LlmProvider): Array<{
    provider: LlmProvider
    adapter: LlmAdapter
    fallbackFromProvider?: LlmProvider
  }> {
    const attempts: Array<{
      provider: LlmProvider
      adapter: LlmAdapter
      fallbackFromProvider?: LlmProvider
    }> = []
    const direct = this.registry[requestedProvider] ?? null

    if (direct) {
      attempts.push({ provider: requestedProvider, adapter: direct })
    }

    for (const fallbackProvider of [this.env.provider, 'openai', 'openai-compatible'] as const) {
      const fallback = this.registry[fallbackProvider]

      if (!fallback || attempts.some((item) => item.provider === fallbackProvider)) {
        continue
      }

      attempts.push({
        provider: fallbackProvider,
        adapter: fallback,
        fallbackFromProvider: requestedProvider,
      })
    }

    return attempts
  }
}

function buildUnifiedResult(input: {
  input: PromptInput
  result: GenerateResult
  providerResolution: { provider: LlmProvider; source: Exclude<LlmResolutionSource, 'fallback'> }
  selectedProvider: LlmProvider
  selectedModel: string
  modelResolution: { model: string; source: LlmModelSource }
  fallbackFromProvider?: LlmProvider
  providerAttemptCount: number
}): GenerateResult {
  return {
    ...input.result,
    provider: input.selectedProvider,
    model: input.selectedModel,
    metadata: {
      ...(input.result.metadata as LlmExecutionMetadata | undefined),
      stage: input.input.metadata?.stage,
      requestedProvider: input.providerResolution.provider,
      selectedProvider: input.selectedProvider,
      providerSource: input.fallbackFromProvider ? 'fallback' : input.providerResolution.source,
      requestedModel: input.input.metadata?.modelHint,
      selectedModel: input.selectedModel,
      modelSource: input.modelResolution.source,
      fallbackUsed: Boolean(input.fallbackFromProvider),
      fallbackFromProvider: input.fallbackFromProvider,
      responseId: input.result.responseId,
      latencyMs: input.result.latencyMs,
      retryCount: input.result.metadata?.retryCount ?? 0,
      timeoutMs: input.input.metadata?.timeoutMs ?? input.result.metadata?.timeoutMs,
      maxRetries: input.input.metadata?.maxRetries ?? input.result.metadata?.maxRetries,
      traceId: input.input.metadata?.traceId ?? input.result.metadata?.traceId,
      providerAttemptCount: input.providerAttemptCount,
    },
  }
}

function createProviderRegistry(env: LlmEnvConfig): Partial<Record<LlmProvider, LlmAdapter>> {
  const registry: Partial<Record<LlmProvider, LlmAdapter>> = {}

  if (env.openAi.apiKey) {
    registry.openai = new OpenAiLlmAdapter({
      apiKey: env.openAi.apiKey,
      baseUrl: env.openAi.baseUrl,
      model: env.openAi.model,
    })
  }

  if (env.openAiCompatible.apiKey) {
    registry['openai-compatible'] = new OpenAiCompatibleLlmAdapter({
      apiKey: env.openAiCompatible.apiKey,
      baseUrl: env.openAiCompatible.baseUrl,
      model: env.openAiCompatible.model,
    })
  }

  return registry
}

function resolveRequestedProvider(
  input: PromptInput,
  env: LlmEnvConfig,
): { provider: LlmProvider; source: Exclude<LlmResolutionSource, 'fallback'> } {
  if (input.metadata?.providerHint) {
    return {
      provider: input.metadata.providerHint,
      source: 'input-hint',
    }
  }

  if (input.metadata?.stage && input.metadata.stage !== 'general') {
    return {
      provider: readLlmStageConfig(input.metadata.stage, env).provider,
      source: 'stage-routing',
    }
  }

  return {
    provider: env.provider,
    source: 'default-provider',
  }
}

function resolveSelectedModel(
  input: PromptInput,
  selectedProvider: LlmProvider,
  env: LlmEnvConfig,
  requestedProvider: LlmProvider,
): { model: string; source: LlmModelSource } {
  const requestedModel = input.metadata?.modelHint

  if (requestedModel && selectedProvider === requestedProvider) {
    return {
      model: requestedModel,
      source: 'input-hint',
    }
  }

  return resolveProviderModel(selectedProvider, input.metadata?.stage, env)
}

function resolveProviderModel(
  provider: LlmProvider,
  stage: LlmTaskStage | undefined,
  env: LlmEnvConfig,
): { model: string; source: LlmModelSource } {
  if (stage && stage !== 'general') {
    const stageConfig = readLlmStageConfig(stage, env)

    if (stageConfig.provider === provider) {
      return {
        model: stageConfig.model,
        source: 'stage-routing',
      }
    }
  }

  return {
    model: provider === 'openai-compatible' ? env.openAiCompatible.model : env.openAi.model,
    source: 'provider-default',
  }
}

function resolveStageExecutionConfig(
  stage: LlmTaskStage | undefined,
  provider: LlmProvider,
  env: LlmEnvConfig,
): { timeoutMs: number; maxRetries: number } {
  if (stage && stage !== 'general') {
    const stageConfig = readLlmStageConfig(stage, env)

    if (stageConfig.provider === provider) {
      return {
        timeoutMs: stageConfig.timeoutMs,
        maxRetries: stageConfig.maxRetries,
      }
    }
  }

  const providerConfig = provider === 'openai-compatible' ? env.openAiCompatible : env.openAi
  return {
    timeoutMs: providerConfig.timeoutMs,
    maxRetries: providerConfig.maxRetries,
  }
}
