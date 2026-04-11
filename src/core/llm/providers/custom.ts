import { env } from "../../../config/env.js";
import type { AppLogger } from "../../logger/index.js";
import { withLlmLogging } from "../logger.js";
import type { LlmClient, LlmGenerateParams, LlmGenerateResult, LlmMessage } from "../types.js";

interface CustomChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class CustomLlmClient implements LlmClient {
  constructor(private readonly logger: AppLogger) {}

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    const model = params.model ?? env.CUSTOM_LLM_MODEL;
    const baseUrl = env.CUSTOM_LLM_BASE_URL;

    if (!baseUrl) {
      throw new Error("CUSTOM_LLM_BASE_URL is required for custom provider");
    }

    return withLlmLogging(this.logger, "custom", model, params, async () => {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.CUSTOM_LLM_API_KEY
            ? { Authorization: `Bearer ${env.CUSTOM_LLM_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: buildCustomMessages(params.messages, params.responseFormat),
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          response_format:
            params.responseFormat === "json" ? { type: "json_object" } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Custom LLM request failed: ${response.status} ${await response.text()}`);
      }

      const raw = (await response.json()) as CustomChatCompletionResponse;
      const content = extractCustomContent(raw);

      return {
        provider: "custom",
        model: raw.model || model,
        content,
        usage: {
          inputTokens: raw.usage?.prompt_tokens,
          outputTokens: raw.usage?.completion_tokens,
          totalTokens: raw.usage?.total_tokens,
        },
        raw,
      };
    });
  }
}

function buildCustomMessages(
  messages: LlmMessage[],
  responseFormat: LlmGenerateParams["responseFormat"],
): Array<{ role: string; content: string }> {
  // custom provider 走的是 OpenAI 兼容 chat/completions 形态，
  // 因此这里沿用与 OpenAI 相同的策略：把 JSON 输出约束追加到 system message。
  if (responseFormat !== "json") {
    return messages;
  }

  return [
    ...messages,
    {
      role: "system",
      content: "Return valid JSON only. Do not include markdown fences or extra explanation.",
    },
  ];
}

function extractCustomContent(raw: CustomChatCompletionResponse): string {
  const content = raw.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  throw new Error("Custom LLM response did not include message content");
}
