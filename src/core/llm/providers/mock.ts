import fs from "node:fs/promises";

import { env } from "../../../config/env.js";
import type { AppLogger } from "../../logger/index.js";
import { withLlmLogging } from "../logger.js";
import type { LlmClient, LlmGenerateParams, LlmGenerateResult } from "../types.js";

export class MockLlmClient implements LlmClient {
  constructor(private readonly logger: AppLogger) {}

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    const model = params.model ?? env.MOCK_LLM_MODEL;

    return withLlmLogging(this.logger, "mock", model, params, async () => {
      const content = await this.buildContent(params);

      return {
        provider: "mock",
        model,
        content,
        usage: estimateUsage(params, content),
        raw: {
          mode: env.MOCK_LLM_MODE,
        },
      };
    });
  }

  private async buildContent(params: LlmGenerateParams): Promise<string> {
    if (env.MOCK_LLM_MODE === "fixture") {
      if (!env.MOCK_LLM_FIXTURE_PATH) {
        throw new Error("MOCK_LLM_FIXTURE_PATH is required when MOCK_LLM_MODE=fixture");
      }

      return fs.readFile(env.MOCK_LLM_FIXTURE_PATH, "utf8");
    }

    const lastUserMessage = [...params.messages].reverse().find((message) => message.role === "user");
    const combinedText = params.messages.map((message) => message.content).join("\n");

    if (combinedText.includes("作者意图草案")) {
      return "本章重点推进主角当前主线，抛出关键线索，并为后续冲突埋下钩子。";
    }

    if (combinedText.includes("请输出章节规划")) {
      return [
        "本章目标：推进当前主线并强化冲突。",
        "主线：主角围绕关键线索展开行动。",
        "支线：补充人物关系和势力态度变化。",
        "出场角色：主角、关键配角、相关势力成员。",
        "关键道具：延续当前章节命中的重要物品。",
        "钩子推进：保持已有未回收钩子的悬念与推进。",
        "风险提醒：避免设定冲突，注意承接上一章状态。",
      ].join("\n");
    }

    if (env.MOCK_LLM_MODE === "json" || params.responseFormat === "json") {
      if (combinedText.includes("intentSummary") && combinedText.includes("mustInclude")) {
        return JSON.stringify(
          {
            intentSummary: "推进当前章节主线并埋下后续冲突",
            keywords: ["主线", "冲突", "线索"],
            mustInclude: ["主角", "关键线索"],
            mustAvoid: ["设定冲突", "人物失真"],
          },
          null,
          2,
        );
      }

      return JSON.stringify(
        {
          provider: "mock",
          summary: env.MOCK_LLM_RESPONSE_TEXT,
          messages: params.messages,
          echo: lastUserMessage?.content ?? "",
        },
        null,
        2,
      );
    }

    return `${env.MOCK_LLM_RESPONSE_TEXT}\n\n${lastUserMessage?.content ?? ""}`.trim();
  }
}

function estimateUsage(params: LlmGenerateParams, content: string): LlmGenerateResult["usage"] {
  const inputLength = params.messages.reduce((sum, message) => sum + message.content.length, 0);
  const outputLength = content.length;
  const inputTokens = Math.max(1, Math.ceil(inputLength / 4));
  const outputTokens = Math.max(1, Math.ceil(outputLength / 4));

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
