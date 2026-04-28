import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../../src/config/env.js";
import { buildPromptContextBlocks } from "../../../src/domain/planning/prompt-context-blocks.js";

test("buildPromptContextBlocks respects stage-specific char budgets", () => {
  const context = {
    hardConstraints: {
      characters: [
        { id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=外门", score: 80 },
      ],
      factions: [],
      items: [
        { id: 2, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character", score: 78 },
      ],
      relations: [],
      hooks: [
        { id: 3, title: "旧案", reason: "keyword_hit", content: "target_chapter_no=8", score: 75 },
      ],
      worldSettings: [
        { id: 4, title: "宗门制度", reason: "institution_context", content: "规则=登记", score: 82 },
      ],
    },
    characters: [
      { id: 1, name: "林夜", reason: "keyword_hit", content: "goal=调查黑铁令", score: 80 },
      { id: 5, name: "顾沉舟", reason: "keyword_hit", content: "background=内门弟子", score: 70 },
      { id: 6, name: "陈执事", reason: "keyword_hit", content: "background=执事", score: 65 },
      { id: 7, name: "外门弟子", reason: "keyword_hit", content: "background=旁观者", score: 60 },
      { id: 8, name: "巡查者", reason: "keyword_hit", content: "background=巡逻", score: 55 },
      { id: 9, name: "司录", reason: "keyword_hit", content: "background=记录员", score: 50 },
    ],
    factions: [],
    items: [
      { id: 2, name: "黑铁令", reason: "keyword_hit", content: "description=身份凭证", score: 78 },
    ],
    relations: [
      { id: 10, reason: "keyword_hit", content: "relation_type=member", score: 66 },
      { id: 11, reason: "keyword_hit", content: "relation_type=observer", score: 64 },
    ],
    hooks: [
      { id: 3, title: "旧案", reason: "keyword_hit", content: "expected_payoff=本章触发", score: 75 },
      { id: 12, title: "宗门试探", reason: "keyword_hit", content: "target_chapter_no=9", score: 71 },
      { id: 13, title: "身份核验", reason: "keyword_hit", content: "target_chapter_no=10", score: 69 },
    ],
    worldSettings: [
      { id: 4, title: "宗门制度", reason: "institution_context", content: "规则=登记", score: 82 },
    ],
    recentChapters: [
      { id: 1, chapterNo: 7, title: "前章", summary: "黑铁令引发异常", status: "done" },
      { id: 2, chapterNo: 8, title: "承接", summary: "顾沉舟开始观察", status: "done" },
      { id: 3, chapterNo: 9, title: "波动", summary: "外门局势变紧", status: "done" },
      { id: 4, chapterNo: 10, title: "升级", summary: "核验制度收紧", status: "done" },
      { id: 5, chapterNo: 11, title: "余波", summary: "多方试探", status: "done" },
    ],
    riskReminders: [
      { text: "注意人物位置连续性" },
      { text: "注意物品归属连续性" },
      { text: "注意规则执行边界" },
      { text: "注意观察者视角稳定" },
      { text: "注意宗门反应递进" },
    ],
    supportingOutlines: [
      { id: 20, title: "外门试炼", reason: "outline_hit", content: "考核升级" },
      { id: 21, title: "宗门旧案", reason: "outline_hit", content: "旧案继续发酵" },
    ],
  };

  const draftBlocks = buildPromptContextBlocks(context, { mode: "draft" });
  const reviewBlocks = buildPromptContextBlocks(context, { mode: "review" });
  const approveDiffBlocks = buildPromptContextBlocks(context, { mode: "approveDiff" });

  const draftChars = Object.values(draftBlocks).flat().join("").length;
  const reviewChars = Object.values(reviewBlocks).flat().join("").length;
  const approveDiffChars = Object.values(approveDiffBlocks).flat().join("").length;

  assert.ok(draftChars <= env.PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET);
  assert.ok(reviewChars <= env.PLANNING_PROMPT_CONTEXT_REVIEW_CHAR_BUDGET);
  assert.ok(approveDiffChars <= env.PLANNING_PROMPT_CONTEXT_APPROVE_DIFF_CHAR_BUDGET);
  assert.ok(draftBlocks.mustFollowFacts.length >= 1);
  assert.ok(draftBlocks.mustFollowFacts.length <= env.PLANNING_PROMPT_CONTEXT_MUST_FOLLOW_LIMIT);
  assert.ok(draftBlocks.recentChanges.length <= env.PLANNING_PROMPT_CONTEXT_RECENT_CHANGES_LIMIT);
  assert.ok(draftBlocks.coreEntities.length <= env.PLANNING_PROMPT_CONTEXT_CORE_ENTITIES_LIMIT);
  assert.ok(draftBlocks.requiredHooks.length <= env.PLANNING_PROMPT_CONTEXT_REQUIRED_HOOKS_LIMIT);
  assert.ok(draftBlocks.forbiddenMoves.length <= env.PLANNING_PROMPT_CONTEXT_FORBIDDEN_MOVES_LIMIT);
  assert.ok(draftBlocks.supportingBackground.length <= env.PLANNING_PROMPT_CONTEXT_SUPPORTING_BACKGROUND_LIMIT);
  assert.ok(reviewBlocks.mustFollowFacts.length >= 1);
  assert.ok(approveDiffBlocks.mustFollowFacts.length >= 1);
  assert.ok(reviewBlocks.supportingBackground.length <= draftBlocks.supportingBackground.length);
  assert.ok(approveDiffBlocks.supportingBackground.length <= draftBlocks.supportingBackground.length);
});

test("buildPromptContextBlocks prefers persisted recentChanges over recomputed carryover", () => {
  const context = {
    hardConstraints: {
      characters: [],
      factions: [],
      items: [],
      relations: [],
      hooks: [],
      worldSettings: [],
    },
    recentChapters: [
      { id: 1, chapterNo: 11, title: "第十一章", summary: "最近承接", status: "approved" },
    ],
    riskReminders: [{ text: "注意默认风险提醒" }],
    recentChanges: [
      { source: "retrieval_fact", label: "第8章事实", detail: "黑铁令旧案尚未收束。", priority: 95 },
      { source: "story_event", label: "第9章事件", detail: "执事档案库再次提起旧案。", priority: 90 },
    ],
  };

  const blocks = buildPromptContextBlocks(context, { mode: "plan" });

  assert.ok(blocks.recentChanges.some((item) => item.includes("第8章事实：黑铁令旧案尚未收束。")));
  assert.ok(blocks.recentChanges.some((item) => item.includes("第9章事件：执事档案库再次提起旧案。")));
  assert.ok(blocks.recentChanges.every((item) => !item.includes("第11章承接")));
});

test("buildPromptContextBlocks keeps later sections when must-follow facts are extremely long", () => {
  const longTail = "设定约束".repeat(300);
  const context = {
    priorityContext: {
      blockingConstraints: Array.from({ length: env.PLANNING_PROMPT_CONTEXT_MUST_FOLLOW_LIMIT + 2 }, (_, index) => ({
        entityType: index % 2 === 0 ? "world_setting" : "hook",
        entityId: index + 1,
        displayName: `强约束${index + 1}`,
        identity: [`强约束${index + 1}`],
        currentState: [`状态${index + 1}=${longTail}`],
        coreConflictOrGoal: [],
        recentChanges: [],
        continuityRisk: [`风险${index + 1}=${longTail}`],
        relevanceReasons: ["continuity_risk"],
        scores: {
          matchScore: 90,
          importanceScore: 90,
          continuityRiskScore: 90,
          recencyScore: 60,
          manualPriorityScore: 0,
          finalScore: 95,
        },
      })),
      decisionContext: [
        {
          entityType: "character",
          entityId: 100,
          displayName: "林夜",
          identity: ["林夜"],
          currentState: ["current_location=青岳宗外门", `goal=${longTail}`],
          coreConflictOrGoal: ["查清黑铁令旧案"],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["high_match_score"],
          scores: {
            matchScore: 88,
            importanceScore: 80,
            continuityRiskScore: 40,
            recencyScore: 55,
            manualPriorityScore: 0,
            finalScore: 90,
          },
        },
      ],
      supportingContext: [
        {
          entityType: "faction",
          entityId: 101,
          displayName: "青岳宗",
          identity: ["青岳宗"],
          currentState: ["core_goal=维持宗门秩序"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["rule_relevant_faction"],
          scores: {
            matchScore: 72,
            importanceScore: 75,
            continuityRiskScore: 20,
            recencyScore: 45,
            manualPriorityScore: 0,
            finalScore: 78,
          },
        },
      ],
      backgroundNoise: [],
    },
    recentChanges: Array.from({ length: env.PLANNING_PROMPT_CONTEXT_RECENT_CHANGES_LIMIT }, (_, index) => ({
      source: "retrieval_fact" as const,
      label: `第${index + 1}章事实`,
      detail: `变化${index + 1}${longTail}`,
      priority: 90 - index,
    })),
    riskReminders: Array.from({ length: env.PLANNING_PROMPT_CONTEXT_FORBIDDEN_MOVES_LIMIT }, (_, index) => ({
      text: `风险提醒${index + 1}${longTail}`,
    })),
    supportingOutlines: Array.from({ length: env.PLANNING_PROMPT_CONTEXT_SUPPORTING_BACKGROUND_LIMIT }, (_, index) => ({
      id: index + 1,
      title: `提纲${index + 1}`,
      reason: "outline_hit",
      content: `背景${index + 1}${longTail}`,
    })),
  };

  const blocks = buildPromptContextBlocks(context, { mode: "draft" });
  assert.ok(blocks.mustFollowFacts.length >= 1);
  assert.ok(blocks.mustFollowFacts.length <= env.PLANNING_PROMPT_CONTEXT_MUST_FOLLOW_LIMIT);
  assert.ok(blocks.recentChanges.length >= 1);
  assert.ok(blocks.coreEntities.length >= 1);
  assert.ok(blocks.requiredHooks.length >= 1);
  assert.ok(Object.values(blocks).flat().join("").length <= env.PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET);
});
