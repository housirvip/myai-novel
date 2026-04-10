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

    if (combinedText.includes("小说审校助手") || combinedText.includes("修复建议")) {
      return JSON.stringify(
        {
          summary: "本章主线明确，黑铁令线索建立有效，但势力反应仍可再加强。",
          issues: [
            "外门其他弟子对黑铁令的反应略快，缺少一两句铺垫。",
            "执事长老的态度可以更鲜明，以增强悬念。",
          ],
          risks: [
            "若后续不解释黑铁令特殊性，当前悬念强度可能提前透支。",
          ],
          continuity_checks: [
            "主角当前身份仍为外门弟子，未出现越级资源获取。",
            "黑铁令当前归属与既有设定一致。",
          ],
          repair_suggestions: [
            "补一段旁观弟子的窃语，强化令牌不寻常。",
            "增加执事短暂迟疑，暗示令牌来历复杂。",
          ],
        },
        null,
        2,
      );
    }

    if (combinedText.includes("小说修稿助手")) {
      return [
        "林夜踏入外门山门时，天色尚未完全亮起，石阶尽头的钟声一下一下传开。",
        "执事长老翻到他的名字时，指尖明显顿了一下，这才将那枚沉甸甸的黑铁令拍进他掌心。",
        "旁边几名弟子原本还在低声说笑，等看清令牌纹路后，声音却像被人掐断似地停住，只剩一句压得极低的窃语，说那东西不该出现在外门。",
        "林夜压下追问的冲动，把令牌收入袖中，却清楚地意识到，这绝不是普通的入门凭证，而是一把会将他卷进更深暗流的钥匙。",
      ].join("\n\n");
    }

    if (combinedText.includes("结构化事实变更") || combinedText.includes("updates 中的 entityType")) {
      return JSON.stringify(
        {
          chapterSummary: "林夜入宗并获得黑铁令，正式察觉其背后隐藏的异常线索。",
          actualCharacterIds: [1],
          actualFactionIds: [1],
          actualItemIds: [1],
          actualHookIds: [1],
          actualWorldSettingIds: [1],
          newCharacters: [],
          newFactions: [],
          newItems: [],
          newHooks: [
            {
              title: "黑铁令与宗门旧案",
              description: "黑铁令可能与宗门旧案相关，后续需要追查来源。",
              keywords: ["黑铁令", "旧案"],
            },
          ],
          newWorldSettings: [],
          updates: [
            {
              entityType: "story_hook",
              entityId: 1,
              action: "append_notes",
              payload: {
                note: "第2章确认黑铁令在外门内部极不寻常，并引出宗门旧案方向。",
              },
            },
            {
              entityType: "item",
              entityId: 1,
              action: "append_notes",
              payload: {
                note: "第2章确认黑铁令会引发外门弟子与执事的异常反应。",
              },
            },
            {
              entityType: "character",
              entityId: 1,
              action: "append_notes",
              payload: {
                note: "第2章起对黑铁令来源产生明确追查意图。",
              },
            },
          ],
        },
        null,
        2,
      );
    }

    if (combinedText.includes("小说定稿助手")) {
      return [
        "晨雾还压在山门石阶上，外门的钟声已经一圈圈荡开。",
        "林夜踏上最后一级台阶时，执事长老正翻看名册。对方翻到他的名字，指尖忽然顿住，随后才从木匣里取出一枚沉甸甸的黑铁令，啪地一声拍进他掌心。",
        "令牌入手冰冷，边缘刻痕像被岁月反复摩挲过。更奇怪的是，周围几名外门弟子一见那令牌，原本散漫的神色立刻变了，有人甚至下意识后退了半步。",
        "“那东西怎么会在他手里？”一声压得极低的窃语飘进耳中，却在执事长老抬眼的一瞬间戛然而止。",
        "林夜没有追问，只将黑铁令缓缓收入袖中。他能感觉到，自己踏进宗门的这一刻，真正推开的不是外门，而是一道更深也更危险的暗门。",
      ].join("\n\n");
    }

    if (combinedText.includes("作者意图草案")) {
      return "本章重点推进主角当前主线，抛出关键线索，并为后续冲突埋下钩子。";
    }

    if (combinedText.includes("根据章节规划创作") || combinedText.includes("章节规划：")) {
      return [
        "林夜踏入外门山门时，天色尚未完全亮起，石阶尽头的钟声正一下一下荡开。",
        "执事长老没有多看他，只在名册上划了一笔，随后将一枚沉甸甸的黑铁令拍进他掌心。",
        "那令牌冰冷异常，边缘刻痕却像被人反复摩挲过。林夜压下疑惑，将它收入袖中，却注意到周围几名弟子的目光明显变了。",
        "他很快意识到，这枚令牌不只是入门凭证，更像一把会把人拖进更深暗流的钥匙。",
      ].join("\n\n");
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
