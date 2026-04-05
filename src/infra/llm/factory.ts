import type {
  GenerateResult,
  LlmAdapter,
  LlmModelSource,
  LlmProvider,
  LlmResolutionSource,
  LlmTaskStage,
  PromptInput,
} from '../../shared/types/domain.js'
import { readLlmEnv, readLlmStageConfig, type LlmEnvConfig } from '../../shared/utils/env.js'
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-adapter.js'
import { OpenAiLlmAdapter } from './openai-adapter.js'

export function createLlmAdapter(): LlmAdapter | null {
  const env = readLlmEnv()
  const registry = createProviderRegistry(env)

  if (Object.keys(registry).length === 0) {
    return null
  }

  return new RoutedLlmAdapter(env, registry)
}

class RoutedLlmAdapter implements LlmAdapter {
  readonly provider: LlmProvider

  constructor(
    private readonly env: LlmEnvConfig,
    private readonly registry: Partial<Record<LlmProvider, LlmAdapter>>,
  ) {
    this.provider = env.provider
  }

  async generateText(input: PromptInput): Promise<GenerateResult> {
    const providerResolution = resolveRequestedProvider(input, this.env)
    const adapterResolution = this.pickAdapter(providerResolution.provider)
    const adapter = adapterResolution.adapter

    if (!adapter) {
      throw new Error('No configured LLM provider is available for this request.')
    }

    const selectedProvider = adapter.provider
    const modelResolution = resolveSelectedModel(input, selectedProvider, this.env, providerResolution.provider)
    const selectedModel = modelResolution.model

    const result = await adapter.generateText({
      ...input,
      metadata: {
        ...input.metadata,
        providerHint: selectedProvider,
        modelHint: selectedModel,
      },
    })

    return {
      ...result,
      provider: selectedProvider,
      model: selectedModel,
      metadata: {
        ...result.metadata,
        stage: input.metadata?.stage,
        requestedProvider: providerResolution.provider,
        selectedProvider,
        providerSource: adapterResolution.fallbackFromProvider ? 'fallback' : providerResolution.source,
        requestedModel: input.metadata?.modelHint,
        selectedModel,
        modelSource: modelResolution.source,
        fallbackUsed: Boolean(adapterResolution.fallbackFromProvider),
        fallbackFromProvider: adapterResolution.fallbackFromProvider,
        responseId: result.responseId,
        latencyMs: result.latencyMs,
        retryCount: result.metadata?.retryCount ?? 0,
      },
    }
  }

  private pickAdapter(requestedProvider: LlmProvider): {
    adapter: LlmAdapter | null
    fallbackFromProvider?: LlmProvider
  } {
    const direct = this.registry[requestedProvider] ?? null

    if (direct) {
      return { adapter: direct }
    }

    const fallback = this.registry[this.env.provider]
      ?? this.registry.openai
      ?? this.registry['openai-compatible']
      ?? null

    return {
      adapter: fallback,
      fallbackFromProvider: fallback ? requestedProvider : undefined,
    }
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
