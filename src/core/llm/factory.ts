import { env } from "../../config/env.js";
import type { AppLogger } from "../logger/index.js";
import { AnthropicLlmClient } from "./providers/anthropic.js";
import { CustomLlmClient } from "./providers/custom.js";
import { MockLlmClient } from "./providers/mock.js";
import { OpenAiLlmClient } from "./providers/openai.js";
import type { LlmClient, LlmProviderName } from "./types.js";

export interface LlmFactory {
  create(provider?: LlmProviderName): LlmClient;
}

export class DefaultLlmFactory implements LlmFactory {
  constructor(private readonly logger: AppLogger) {}

  create(provider = env.LLM_PROVIDER): LlmClient {
    switch (provider) {
      case "mock":
        return new MockLlmClient(this.logger);
      case "openai":
        return new OpenAiLlmClient(this.logger);
      case "anthropic":
        return new AnthropicLlmClient(this.logger);
      case "custom":
        return new CustomLlmClient(this.logger);
      default:
        throw new Error(`Unsupported LLM provider: ${provider satisfies never}`);
    }
  }
}

export function createLlmFactory(logger: AppLogger): LlmFactory {
  return new DefaultLlmFactory(logger);
}
