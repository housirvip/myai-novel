export type LlmProviderName = "mock" | "openai" | "anthropic" | "custom";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmGenerateParams {
  model?: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface LlmGenerateResult {
  provider: LlmProviderName;
  model: string;
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export interface LlmClient {
  generate(params: LlmGenerateParams): Promise<LlmGenerateResult>;
}
