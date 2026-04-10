import type { AppLogger } from "../logger/index.js";
import { serializeError, serializeLlmContent } from "../logger/serializers.js";
import type { LlmGenerateParams, LlmGenerateResult, LlmProviderName } from "./types.js";

export async function withLlmLogging(
  logger: AppLogger,
  provider: LlmProviderName,
  model: string,
  params: LlmGenerateParams,
  action: () => Promise<LlmGenerateResult>,
): Promise<LlmGenerateResult> {
  const startedAt = Date.now();
  const requestText = params.messages.map((message) => `[${message.role}] ${message.content}`).join("\n\n");

  logger.info(
    {
      event: "llm.call.start",
      provider,
      model,
      responseFormat: params.responseFormat ?? "text",
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      ...serializeLlmContent(requestText),
    },
    "LLM call started",
  );

  try {
    const result = await action();
    logger.info(
      {
        event: "llm.call.finish",
        provider,
        model: result.model,
        success: true,
        durationMs: Date.now() - startedAt,
        usage: result.usage,
        ...serializeLlmContent(result.content),
      },
      "LLM call finished",
    );
    return result;
  } catch (error) {
    logger.error(
      {
        event: "llm.call.error",
        provider,
        model,
        success: false,
        durationMs: Date.now() - startedAt,
        ...serializeError(error),
      },
      "LLM call failed",
    );
    throw error;
  }
}
