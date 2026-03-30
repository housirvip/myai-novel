export type PromptInput = {
  system: string;
  user: string;
  metadata?: Record<string, string | number | boolean>;
};

export type GenerateResult = {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
};

export interface LlmAdapter {
  generateText(input: PromptInput): Promise<GenerateResult>;
  generateStructured<T>(input: PromptInput, schemaName: string): Promise<T>;
}
