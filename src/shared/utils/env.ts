export type LlmEnvConfig = {
  openAiApiKey?: string
  openAiBaseUrl: string
}

export function readLlmEnv(): LlmEnvConfig {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  }
}
