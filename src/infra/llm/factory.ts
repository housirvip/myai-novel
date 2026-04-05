import type {
  GenerateResult,
  LlmAdapter,
  LlmProvider,
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
    const requestedProvider = resolveRequestedProvider(input, this.env)
    const adapter = this.pickAdapter(requestedProvider)

    if (!adapter) {
      throw new Error('No configured LLM provider is available for this request.')
    }

    const selectedProvider = adapter.provider
    const selectedModel = resolveSelectedModel(input, selectedProvider, this.env, requestedProvider)

    return adapter.generateText({
      ...input,
      metadata: {
        ...input.metadata,
        providerHint: selectedProvider,
        modelHint: selectedModel,
      },
    })
  }

  private pickAdapter(requestedProvider: LlmProvider): LlmAdapter | null {
    return this.registry[requestedProvider]
      ?? this.registry[this.env.provider]
      ?? this.registry.openai
      ?? this.registry['openai-compatible']
      ?? null
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

function resolveRequestedProvider(input: PromptInput, env: LlmEnvConfig): LlmProvider {
  if (input.metadata?.providerHint) {
    return input.metadata.providerHint
  }

  if (input.metadata?.stage && input.metadata.stage !== 'general') {
    return readLlmStageConfig(input.metadata.stage, env).provider
  }

  return env.provider
}

function resolveSelectedModel(
  input: PromptInput,
  selectedProvider: LlmProvider,
  env: LlmEnvConfig,
  requestedProvider: LlmProvider,
): string {
  const requestedModel = input.metadata?.modelHint

  if (requestedModel && selectedProvider === requestedProvider) {
    return requestedModel
  }

  return resolveProviderModel(selectedProvider, input.metadata?.stage, env)
}

function resolveProviderModel(
  provider: LlmProvider,
  stage: LlmTaskStage | undefined,
  env: LlmEnvConfig,
): string {
  if (stage && stage !== 'general') {
    const stageConfig = readLlmStageConfig(stage, env)

    if (stageConfig.provider === provider) {
      return stageConfig.model
    }
  }

  return provider === 'openai-compatible' ? env.openAiCompatible.model : env.openAi.model
}
