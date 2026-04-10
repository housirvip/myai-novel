import type { LlmMessage } from "../../core/llm/types.js";
import type { PlanRetrievedContext } from "./types.js";

export function buildIntentGenerationPrompt(input: {
  bookTitle: string;
  chapterNo: number;
  outlinesText: string;
  recentChapterText: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名长篇小说作者助手。请根据近期大纲和前文章节摘要，生成一段简洁但明确的本章作者意图草案。",
    },
    {
      role: "user",
      content: [
        `书名：${input.bookTitle}`,
        `章节号：第 ${input.chapterNo} 章`,
        "",
        "相关大纲：",
        input.outlinesText,
        "",
        "近期章节：",
        input.recentChapterText,
        "",
        "请输出本章作者意图草案，聚焦本章要推进的主线、冲突和钩子。",
      ].join("\n"),
    },
  ];
}

export function buildKeywordExtractionPrompt(input: {
  authorIntent: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说规划助手。请从作者意图中提取关键词，并返回 JSON：intentSummary, keywords, mustInclude, mustAvoid。keywords 中每个词不超过 8 个字。",
    },
    {
      role: "user",
      content: `作者意图：\n${input.authorIntent}`,
    },
  ];
}

export function buildPlanPrompt(input: {
  bookTitle: string;
  chapterNo: number;
  authorIntent: string;
  retrievedContext: PlanRetrievedContext;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名长篇网文策划助手。请基于给定上下文输出结构化章节规划，保证连续性、设定一致性和钩子推进。",
    },
    {
      role: "user",
      content: [
        `书名：${input.bookTitle}`,
        `章节号：第 ${input.chapterNo} 章`,
        "",
        `作者意图：${input.authorIntent}`,
        "",
        "召回上下文：",
        JSON.stringify(input.retrievedContext, null, 2),
        "",
        "请输出章节规划，包含：本章目标、主线、支线、出场角色、出场势力、关键道具、钩子推进、节奏分段、风险提醒。",
      ].join("\n"),
    },
  ];
}

export function buildDraftPrompt(input: {
  planContent: string;
  retrievedContext?: unknown;
  targetWords?: number;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇网络小说写作助手。",
          "请根据章节规划创作完整、自然、连贯的章节草稿。",
          "召回上下文中的人物状态、关系、势力信息、物品归属、钩子状态、世界规则，默认都应视为硬约束。",
          "如果章节规划与召回上下文有细微冲突，优先保证设定一致和前后连续，再在正文里自然化处理。",
          "不要为了推进剧情而随意改写人物性格、能力边界、世界规则、货币体系、战力体系。",
          "若必须引入新信息，请保持克制，并避免与已召回设定直接冲突。",
          "输出时只给正文，不要附解释、标题清单或额外说明。",
        ].join(""),
    },
    {
      role: "user",
      content: [
        "章节规划：",
        input.planContent,
        input.retrievedContext ? `\n召回上下文（必须严格参考）：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        input.targetWords ? `\n目标字数：${input.targetWords}` : "",
        "",
        "写作要求：",
        "1. 必须覆盖章节规划中的主线推进、支线推进和钩子推进。",
        "2. 人物行为要符合已召回的人设、目标、位置、能力和关系。",
        "3. 世界设定、势力状态、物品状态、关系状态不能自相矛盾。",
        "4. 节奏上要像小说正文，不要写成大纲复述。",
        "5. 如果上下文里有风险提醒，正文中要主动规避对应问题。",
        "6. 只输出完整章节草稿正文。",
      ].join("\n"),
    },
  ];
}

export function buildReviewPrompt(input: {
  planContent: string;
  draftContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说审校助手。请检查草稿的设定一致性、人物行为、节奏、逻辑漏洞和钩子推进，并返回结构化审阅结果。",
    },
    {
      role: "user",
      content: [
        "章节规划：",
        input.planContent,
        "",
        "章节草稿：",
        input.draftContent,
        input.retrievedContext ? `\n召回上下文：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        "",
        "请输出：总结、问题列表、风险列表、连续性检查、修复建议。",
      ].join("\n"),
    },
  ];
}

export function buildRepairPrompt(input: {
  planContent: string;
  draftContent: string;
  reviewContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说修稿助手。请根据章节规划、召回上下文和审阅意见修复章节草稿，尽量少破坏已有可用内容，并保持主线、设定和人物行为一致。",
    },
    {
      role: "user",
      content: [
        "章节规划：",
        input.planContent,
        "",
        "当前草稿：",
        input.draftContent,
        "",
        "审阅结果：",
        input.reviewContent,
        input.retrievedContext ? `\n召回上下文：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        "",
        "请输出修复后的完整草稿，优先修复审阅问题，同时不要偏离既有规划和召回设定。",
      ].join("\n"),
    },
  ];
}

export function buildApprovePrompt(input: {
  planContent: string;
  draftContent: string;
  reviewContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇小说定稿助手。",
          "请基于章节规划、当前草稿、审阅结果和召回上下文，输出可直接作为正式稿保存的最终章节文稿。",
          "你必须修复审阅里指出的问题，同时保留章节原本应推进的主线、支线、人物关系和钩子。",
          "召回上下文中的设定与事实默认都应视为正式约束，不要为了润色而改坏连续性。",
          "输出时只给最终正文，不要附带说明、批注、总结或解释。",
        ].join(""),
    },
    {
      role: "user",
      content: [
        "章节规划：",
        input.planContent,
        "",
        "当前草稿：",
        input.draftContent,
        "",
        "审阅结果：",
        input.reviewContent,
        input.retrievedContext ? `\n召回上下文（必须保持一致）：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        "",
        "定稿要求：",
        "1. 修复审阅中提到的问题。",
        "2. 不要丢失原计划中的关键剧情推进和钩子推进。",
        "3. 不要违背召回出的设定、人物状态、关系和世界规则。",
        "4. 尽量继承当前草稿中已经写得好的段落和气氛。",
        "5. 只输出最终文稿正文。",
      ].join("\n"),
    },
  ];
}

export function buildApproveDiffPrompt(input: {
  finalContent: string;
  planContent: string;
  reviewContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说事实整理助手。请根据最终文稿、章节规划和审阅结果，输出结构化 JSON，用于更新设定数据库。",
    },
    {
      role: "user",
      content: [
        "最终文稿：",
        input.finalContent,
        "",
        "章节规划：",
        input.planContent,
        "",
        "审阅结果：",
        input.reviewContent,
        input.retrievedContext ? `\n召回上下文：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        "",
        "请返回 JSON，包含：chapterSummary, actualCharacterIds, actualFactionIds, actualItemIds, actualHookIds, actualWorldSettingIds, newCharacters, newFactions, newItems, newHooks, newWorldSettings, newRelations, updates。",
        "newRelations 用于新增关系，字段包含 sourceType, sourceId, targetType, targetId, relationType, intensity, status, description, keywords。",
        "updates 中的 entityType 支持 character, faction, relation, item, story_hook, world_setting；action 支持 update_fields, append_notes, status_change。",
      ].join("\n"),
    },
  ];
}
