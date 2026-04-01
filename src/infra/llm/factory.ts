import type { Book, LlmAdapter } from '../../shared/types/domain.js'
import { readLlmEnv } from '../../shared/utils/env.js'
import { OpenAiLlmAdapter } from './openai-adapter.js'

export function createLlmAdapter(book: Book | null): LlmAdapter | null {
  if (!book) {
    return null
  }

  const env = readLlmEnv()

  if (book.model.provider !== 'openai' || !env.openAiApiKey) {
    return null
  }

  return new OpenAiLlmAdapter({
    apiKey: env.openAiApiKey,
    baseUrl: env.openAiBaseUrl,
    model: book.model.modelName,
  })
}
