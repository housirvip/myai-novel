import { env } from "../../../config/env.js";
import type { AppLogger } from "../../logger/index.js";
import { withLlmLogging } from "../logger.js";
import type { LlmClient, LlmGenerateParams, LlmGenerateResult, LlmMessage } from "../types.js";

interface AnthropicMessagesResponse {
  id: string;
  model: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly logger: AppLogger) {}

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    const model = params.model ?? env.ANTHROPIC_MODEL;
    const baseUrl = env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1";
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for Anthropic provider");
    }

    return withLlmLogging(this.logger, "anthropic", model, params, async () => {
      // Anthropic 接口把 system 与 messages 明确拆开，
      // 为了尽量贴近真实对话上下文，这里把 JSON 约束追加到 conversation messages 末尾，而不是并入统一 system 文本。
      const systemMessages = params.messages.filter((message) => message.role === "system");
      const conversationMessages = appendJsonInstruction(
        params.messages.filter((message) => message.role !== "system"),
        params.responseFormat,
      );

      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: params.maxTokens ?? env.LLM_DEFAULT_MAX_TOKENS,
          temperature: params.temperature,
          system: systemMessages.map((message) => message.content).join("\n\n"),
          messages: conversationMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
      }

      const raw = (await response.json()) as AnthropicMessagesResponse;
      const content = raw.content
        ?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!content) {
        throw new Error("Anthropic response did not include text content");
      }

      return {
        provider: "anthropic",
        model: raw.model || model,
        content,
        usage: {
          inputTokens: raw.usage?.input_tokens,
          outputTokens: raw.usage?.output_tokens,
          totalTokens:
            raw.usage?.input_tokens !== undefined && raw.usage?.output_tokens !== undefined
              ? raw.usage.input_tokens + raw.usage.output_tokens
              : undefined,
        },
        raw,
      };
    });
  }
}

function appendJsonInstruction(
  messages: LlmMessage[],
  responseFormat: LlmGenerateParams["responseFormat"],
): LlmMessage[] {
  if (responseFormat !== "json") {
    return messages;
  }

  // 这里使用 user message 而不是 system message，
  // 是为了与上面的 Anthropic 请求结构保持一致：system 单独聚合，输出格式约束则作为会话末尾的显式要求追加。
  return [
    ...messages,
    {
      role: "user",
      content: "Return valid JSON only. Do not include markdown fences or extra explanation.",
    },
  ];
}
