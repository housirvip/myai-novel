import { env } from "../../../config/env.js";
import type { AppLogger } from "../../logger/index.js";
import { withLlmLogging } from "../logger.js";
import type { LlmClient, LlmGenerateParams, LlmGenerateResult, LlmMessage } from "../types.js";

interface OpenAiChatCompletionResponse {
  id: string;
  model: string;
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

export class OpenAiLlmClient implements LlmClient {
  constructor(private readonly logger: AppLogger) {}

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    const model = params.model ?? env.OPENAI_MODEL;
    const baseUrl = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI provider");
    }

    return withLlmLogging(this.logger, "openai", model, params, async () => {
      // 这里固定走 chat/completions，是因为当前工程里的 prompt 结构就是传统多轮消息模型。
      // 只要 provider 仍兼容这套接口，workflow 层就不需要感知具体厂商差异。
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: buildOpenAiMessages(params.messages, params.responseFormat),
          temperature: params.temperature,
          max_completion_tokens: params.maxTokens,
          response_format:
            params.responseFormat === "json" ? { type: "json_object" } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
      }

      const raw = (await response.json()) as OpenAiChatCompletionResponse;
      const content = extractOpenAiContent(raw);

      return {
        provider: "openai",
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

function buildOpenAiMessages(
  messages: LlmMessage[],
  responseFormat: LlmGenerateParams["responseFormat"],
): Array<{ role: string; content: string }> {
  // OpenAI 兼容接口通常更稳定地遵循 system 指令，
  // 因此这里把 JSON 约束附加到 system message。
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

function extractOpenAiContent(raw: OpenAiChatCompletionResponse): string {
  const content = raw.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    // 有些兼容实现会把文本拆成 content parts，
    // 这里统一拼回单字符串，保证上层 workflow 不需要再区分响应分片形态。
    return content
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  throw new Error("OpenAI response did not include message content");
}
