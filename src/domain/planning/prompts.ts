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
        "你是一名网络小说写作助手。请根据章节规划创作自然连贯的章节草稿，注意角色行为和世界设定一致。",
    },
    {
      role: "user",
      content: [
        "章节规划：",
        input.planContent,
        input.retrievedContext ? `\n召回上下文：\n${JSON.stringify(input.retrievedContext, null, 2)}` : "",
        input.targetWords ? `\n目标字数：${input.targetWords}` : "",
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
  draftContent: string;
  reviewContent: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说修稿助手。请根据审阅意见修复章节草稿，尽量少破坏已有可用内容。",
    },
    {
      role: "user",
      content: [
        "当前草稿：",
        input.draftContent,
        "",
        "审阅结果：",
        input.reviewContent,
        "",
        "请输出修复后的完整草稿。",
      ].join("\n"),
    },
  ];
}

export function buildApprovePrompt(input: {
  planContent: string;
  draftContent: string;
  reviewContent: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说定稿助手。请基于计划、草稿和审阅结果输出润色后的最终章节文稿，只输出正文。",
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
        "",
        "请输出最终文稿，要求修复审阅中提到的问题，并保留当前章节的主线、钩子和设定一致性。",
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
