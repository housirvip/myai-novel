import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../../src/config/env.js";
import { buildPromptContextBlocks, buildPromptContextBlocksObserved } from "../../../src/domain/planning/prompt-context-blocks.js";

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
  const planBlocks = buildPromptContextBlocks(context, { mode: "plan" });
  const reviewBlocks = buildPromptContextBlocks(context, { mode: "review" });
  const approveDiffBlocks = buildPromptContextBlocks(context, { mode: "approveDiff" });

  const planChars = Object.values(planBlocks).flat().join("").length;
  const draftChars = Object.values(draftBlocks).flat().join("").length;
  const reviewChars = Object.values(reviewBlocks).flat().join("").length;
  const approveDiffChars = Object.values(approveDiffBlocks).flat().join("").length;

  assert.ok(planChars <= env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET);
  assert.ok(draftChars <= env.PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET);
  assert.ok(reviewChars <= env.PLANNING_PROMPT_CONTEXT_REVIEW_CHAR_BUDGET);
  assert.ok(approveDiffChars <= env.PLANNING_PROMPT_CONTEXT_APPROVE_DIFF_CHAR_BUDGET);
  assert.ok(planBlocks.mustFollowFacts.length >= 1);
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

test("buildPromptContextBlocksObserved gives plan mode extra room in recent changes hooks and background", () => {
  const hookDetail = "钩子承接".repeat(87);
  const recentDetail = "近期变化".repeat(121);
  const backgroundDetail = "背景信息".repeat(99);
  const observed = buildPromptContextBlocksObserved({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "world_setting",
          entityId: 1,
          displayName: "宗门制度",
          identity: ["宗门制度"],
          currentState: ["规则=凭令入门"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["登记规则不能失效"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 90,
            importanceScore: 90,
            continuityRiskScore: 90,
            recencyScore: 60,
            manualPriorityScore: 0,
            finalScore: 96,
          },
        },
        {
          entityType: "hook",
          entityId: 2,
          displayName: "黑铁令旧案",
          identity: ["黑铁令旧案"],
          currentState: [`target_chapter_no=${hookDetail}`],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 88,
            importanceScore: 89,
            continuityRiskScore: 92,
            recencyScore: 58,
            manualPriorityScore: 0,
            finalScore: 95,
          },
        },
        {
          entityType: "hook",
          entityId: 3,
          displayName: "执事试探",
          identity: ["执事试探"],
          currentState: [`expected_payoff=${hookDetail}`],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 87,
            importanceScore: 88,
            continuityRiskScore: 90,
            recencyScore: 57,
            manualPriorityScore: 0,
            finalScore: 94,
          },
        },
      ],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
    recentChanges: [
      { source: "retrieval_fact", label: "第18章事实", detail: recentDetail, priority: 95 },
      { source: "story_event", label: "第19章事件", detail: recentDetail, priority: 94 },
    ],
    supportingOutlines: [
      { id: 11, title: "旧案背景", reason: "outline_hit", content: backgroundDetail },
      { id: 12, title: "档案库背景", reason: "outline_hit", content: backgroundDetail },
    ],
    riskReminders: [],
  }, { mode: "plan" });

  assert.equal(observed.observability.charBudget, env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET);
  assert.equal(observed.observability.sections.mustFollowFacts.clippedCount, 0);
  assert.equal(observed.observability.sections.recentChanges.clippedCount, 0);
  assert.equal(observed.observability.sections.requiredHooks.clippedCount, 0);
  assert.ok(observed.observability.sections.supportingBackground.clippedCount >= 1);
  assert.equal(observed.blocks.recentChanges.length, 2);
  assert.equal(observed.blocks.requiredHooks.length, 2);
  assert.ok(observed.blocks.supportingBackground.length >= 1);
  assert.ok(observed.blocks.recentChanges.every((item) => !item.endsWith("…")));
  assert.ok(observed.blocks.requiredHooks.every((item) => !item.endsWith("…")));
});

test("buildPromptContextBlocks keeps hooks out of mustFollowFacts when non-hook blocking facts exist in plan mode", () => {
  const blocks = buildPromptContextBlocks({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "world_setting",
          entityId: 1,
          displayName: "宗门制度",
          identity: ["宗门制度"],
          currentState: ["规则=凭令入门"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["规则不能失效"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 95,
            importanceScore: 95,
            continuityRiskScore: 95,
            recencyScore: 60,
            manualPriorityScore: 0,
            finalScore: 98,
          },
        },
        {
          entityType: "hook",
          entityId: 2,
          displayName: "黑铁令旧案",
          identity: ["黑铁令旧案"],
          currentState: ["target_chapter_no=120"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 90,
            importanceScore: 90,
            continuityRiskScore: 92,
            recencyScore: 55,
            manualPriorityScore: 0,
            finalScore: 94,
          },
        },
      ],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
  }, { mode: "plan" });

  assert.ok(blocks.mustFollowFacts.some((item) => item.includes("宗门制度")));
  assert.ok(blocks.mustFollowFacts.every((item) => !item.includes("黑铁令旧案")));
  assert.ok(blocks.requiredHooks.some((item) => item.includes("黑铁令旧案")));
});

test("buildPromptContextBlocks avoids duplicating the same hook across mustFollowFacts and requiredHooks in hook-only plan mode", () => {
  const blocks = buildPromptContextBlocks({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "hook",
          entityId: 2,
          displayName: "黑铁令旧案",
          identity: ["黑铁令旧案"],
          currentState: ["target_chapter_no=120"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 90,
            importanceScore: 90,
            continuityRiskScore: 92,
            recencyScore: 55,
            manualPriorityScore: 0,
            finalScore: 94,
          },
        },
      ],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
  }, { mode: "plan" });

  assert.ok(blocks.mustFollowFacts.some((item) => item.includes("黑铁令旧案")));
  assert.ok(blocks.requiredHooks.every((item) => !item.includes("黑铁令旧案")));
});

test("buildPromptContextBlocks prioritizes persisted recent changes in plan mode under line pressure", () => {
  const blocks = buildPromptContextBlocks({
    priorityContext: {
      blockingConstraints: [],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
    recentChanges: [
      { source: "risk_reminder" as const, label: "高风险提醒1", detail: "非 persisted 风险", priority: 100 },
      { source: "chapter_summary" as const, label: "第11章承接", detail: "章节承接", priority: 99 },
      { source: "entity_state" as const, label: "林夜", detail: "状态变化", priority: 98 },
      { source: "retrieval_fact" as const, label: "第8章事实", detail: "黑铁令旧案尚未收束。", priority: 95 },
      { source: "story_event" as const, label: "第9章事件", detail: "执事档案库再次提起旧案。", priority: 94 },
      { source: "chapter_summary" as const, label: "第10章承接", detail: "次级承接", priority: 93 },
      { source: "entity_state" as const, label: "顾沉舟", detail: "观察升级", priority: 92 },
    ],
  }, { mode: "plan" });

  assert.ok(blocks.recentChanges.some((item) => item.includes("第8章事实：黑铁令旧案尚未收束。")));
  assert.ok(blocks.recentChanges.some((item) => item.includes("第9章事件：执事档案库再次提起旧案。")));
});

test("buildPromptContextBlocks gives requiredHooks priority over coreEntities in noisy plan mode", () => {
  const longCore = "核心人物背景".repeat(120);
  const longHook = "关键钩子推进".repeat(120);
  const planObserved = buildPromptContextBlocksObserved({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "hook",
          entityId: 1,
          displayName: "黑铁令旧案",
          identity: ["黑铁令旧案"],
          currentState: [longHook],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 92,
            importanceScore: 92,
            continuityRiskScore: 95,
            recencyScore: 58,
            manualPriorityScore: 0,
            finalScore: 97,
          },
        },
      ],
      decisionContext: Array.from({ length: 4 }, (_, index) => ({
        entityType: "character" as const,
        entityId: index + 10,
        displayName: `人物${index + 1}`,
        identity: [`人物${index + 1}`],
        currentState: [longCore],
        coreConflictOrGoal: [longCore],
        recentChanges: [],
        continuityRisk: [],
        relevanceReasons: ["high_match_score"],
        scores: {
          matchScore: 85 - index,
          importanceScore: 80,
          continuityRiskScore: 10,
          recencyScore: 50,
          manualPriorityScore: 0,
          finalScore: 88 - index,
        },
      })),
      supportingContext: [
        {
          entityType: "faction",
          entityId: 99,
          displayName: "青岳宗",
          identity: ["青岳宗"],
          currentState: ["core_goal=维持秩序"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["rule_relevant_faction"],
          scores: {
            matchScore: 70,
            importanceScore: 70,
            continuityRiskScore: 5,
            recencyScore: 40,
            manualPriorityScore: 0,
            finalScore: 72,
          },
        },
      ],
      backgroundNoise: [],
    },
    recentChanges: [],
    supportingOutlines: [
      { id: 1, title: "外门背景", reason: "outline_hit", content: "背景设定".repeat(120) },
      { id: 2, title: "旧案背景", reason: "outline_hit", content: "背景设定".repeat(120) },
    ],
    riskReminders: [],
  }, { mode: "plan" });
  const draftObserved = buildPromptContextBlocksObserved({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "hook",
          entityId: 1,
          displayName: "黑铁令旧案",
          identity: ["黑铁令旧案"],
          currentState: [longHook],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["continuity_risk"],
          scores: {
            matchScore: 92,
            importanceScore: 92,
            continuityRiskScore: 95,
            recencyScore: 58,
            manualPriorityScore: 0,
            finalScore: 97,
          },
        },
      ],
      decisionContext: Array.from({ length: 4 }, (_, index) => ({
        entityType: "character" as const,
        entityId: index + 10,
        displayName: `人物${index + 1}`,
        identity: [`人物${index + 1}`],
        currentState: [longCore],
        coreConflictOrGoal: [longCore],
        recentChanges: [],
        continuityRisk: [],
        relevanceReasons: ["high_match_score"],
        scores: {
          matchScore: 85 - index,
          importanceScore: 80,
          continuityRiskScore: 10,
          recencyScore: 50,
          manualPriorityScore: 0,
          finalScore: 88 - index,
        },
      })),
      supportingContext: [
        {
          entityType: "faction",
          entityId: 99,
          displayName: "青岳宗",
          identity: ["青岳宗"],
          currentState: ["core_goal=维持秩序"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["rule_relevant_faction"],
          scores: {
            matchScore: 70,
            importanceScore: 70,
            continuityRiskScore: 5,
            recencyScore: 40,
            manualPriorityScore: 0,
            finalScore: 72,
          },
        },
      ],
      backgroundNoise: [],
    },
    recentChanges: [],
    supportingOutlines: [
      { id: 1, title: "外门背景", reason: "outline_hit", content: "背景设定".repeat(120) },
      { id: 2, title: "旧案背景", reason: "outline_hit", content: "背景设定".repeat(120) },
    ],
    riskReminders: [],
  }, { mode: "draft" });

  assert.ok(
    planObserved.blocks.requiredHooks.some((item) => item.includes("黑铁令旧案"))
      || planObserved.blocks.mustFollowFacts.some((item) => item.includes("黑铁令旧案")),
  );
  assert.ok(
    draftObserved.observability.sections.requiredHooks.clippedCount
      >= planObserved.observability.sections.requiredHooks.clippedCount,
  );
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

test("buildPromptContextBlocks prioritizes persisted packets ahead of ordinary entities within prompt sections", () => {
  const context = {
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "character",
          entityId: 1,
          displayName: "林夜",
          identity: ["林夜"],
          currentState: ["current_location=青岳宗外门"],
          coreConflictOrGoal: ["goal=调查黑铁令"],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["high_match_score"],
          scores: {
            matchScore: 96,
            importanceScore: 90,
            continuityRiskScore: 20,
            recencyScore: 60,
            manualPriorityScore: 0,
            finalScore: 97,
          },
        },
        {
          entityType: "chapter",
          entityId: -11,
          displayName: "第8章事实",
          identity: ["chapter_summary"],
          currentState: ["黑铁令旧案尚未收束。"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["高风险已知事实需要承接"],
          relevanceReasons: ["persisted_fact"],
          sourceRef: { sourceType: "persisted_fact" as const, sourceId: 11 },
          scores: {
            matchScore: 80,
            importanceScore: 90,
            continuityRiskScore: 88,
            recencyScore: 45,
            manualPriorityScore: 0,
            finalScore: 90,
          },
        },
      ],
      decisionContext: [
        {
          entityType: "character",
          entityId: 2,
          displayName: "顾沉舟",
          identity: ["顾沉舟"],
          currentState: ["current_location=内门"],
          coreConflictOrGoal: ["goal=观察局势"],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["high_match_score"],
          scores: {
            matchScore: 92,
            importanceScore: 86,
            continuityRiskScore: 10,
            recencyScore: 52,
            manualPriorityScore: 0,
            finalScore: 94,
          },
        },
      ],
      supportingContext: [
        {
          entityType: "chapter",
          entityId: -(100000 + 12),
          displayName: "第9章事件",
          identity: ["旧案回收前兆"],
          currentState: ["执事档案库再次提起旧案。"],
          coreConflictOrGoal: ["仍需确认黑铁副令来源。"],
          recentChanges: [],
          continuityRisk: ["未收束事件需要持续承接"],
          relevanceReasons: ["persisted_event"],
          sourceRef: { sourceType: "persisted_event" as const, sourceId: 12 },
          scores: {
            matchScore: 60,
            importanceScore: 60,
            continuityRiskScore: 70,
            recencyScore: 46,
            manualPriorityScore: 0,
            finalScore: 72,
          },
        },
        {
          entityType: "faction",
          entityId: 3,
          displayName: "青岳宗",
          identity: ["青岳宗"],
          currentState: ["core_goal=维持秩序"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["rule_relevant_faction"],
          scores: {
            matchScore: 88,
            importanceScore: 82,
            continuityRiskScore: 5,
            recencyScore: 40,
            manualPriorityScore: 0,
            finalScore: 89,
          },
        },
      ],
      backgroundNoise: [],
    },
  };

  const blocks = buildPromptContextBlocks(context, { mode: "plan" });
  assert.match(blocks.mustFollowFacts[0] ?? "", /第8章事实/);
  assert.match(blocks.coreEntities[0] ?? "", /第9章事件/);
});

test("buildPromptContextBlocksObserved reports clipping losses and surfaced persisted refs", () => {
  const veryLongDetail = "黑铁令旧案仍需承接。".repeat(80);
  const observed = buildPromptContextBlocksObserved({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "chapter",
          entityId: -(100000 + 2),
          displayName: "第3章事件",
          identity: ["旧案回响"],
          currentState: [veryLongDetail],
          coreConflictOrGoal: [veryLongDetail],
          recentChanges: [],
          continuityRisk: [veryLongDetail],
          relevanceReasons: ["persisted_event"],
          sourceRef: { sourceType: "persisted_event" as const, sourceId: 2 },
          scores: {
            matchScore: 70,
            importanceScore: 70,
            continuityRiskScore: 90,
            recencyScore: 20,
            manualPriorityScore: 0,
            finalScore: 88,
          },
        },
        {
          entityType: "chapter",
          entityId: -1,
          displayName: "第18章事实",
          identity: ["chapter_summary"],
          currentState: ["林夜仍在追查黑铁令旧案。"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: ["必须承接"],
          relevanceReasons: ["persisted_fact"],
          sourceRef: { sourceType: "persisted_fact" as const, sourceId: 1 },
          scores: {
            matchScore: 80,
            importanceScore: 80,
            continuityRiskScore: 85,
            recencyScore: 45,
            manualPriorityScore: 0,
            finalScore: 86,
          },
        },
      ],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
    recentChanges: [
      {
        source: "retrieval_fact" as const,
        label: "第18章事实",
        detail: "林夜仍在追查黑铁令旧案。",
        priority: 90,
        sourceRef: { sourceType: "persisted_fact" as const, sourceId: 1 },
      },
    ],
    riskReminders: [
      {
        text: "注意未收束事件：真正主谋仍未现身。",
        sourceRef: { sourceType: "persisted_event" as const, sourceId: 2 },
      },
    ],
    retrievalObservability: {
      query: { chapterNo: 20, keywordCount: 3, queryTextLength: 12 },
      candidateVolumes: {
        beforeRerank: {
          hooks: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "hook" as const },
          characters: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "character" as const },
          factions: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "faction" as const },
          items: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "item" as const },
          relations: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "relation" as const },
          worldSettings: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "world_setting" as const },
        },
        afterRerank: {
          hooks: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "hook" as const },
          characters: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "character" as const },
          factions: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "faction" as const },
          items: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "item" as const },
          relations: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "relation" as const },
          worldSettings: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "world_setting" as const },
        },
        recentChaptersScanned: 0,
        recentChaptersKept: 0,
        outlinesKept: 0,
      },
      retention: {
        hardConstraintPromotionCounts: {
          hooks: { promoted: 0, leftAsSoft: 0 },
          characters: { promoted: 0, leftAsSoft: 0 },
          factions: { promoted: 0, leftAsSoft: 0 },
          items: { promoted: 0, leftAsSoft: 0 },
          relations: { promoted: 0, leftAsSoft: 0 },
          worldSettings: { promoted: 0, leftAsSoft: 0 },
        },
        priorityBucketCounts: {
          blockingConstraints: 2,
          decisionContext: 0,
          supportingContext: 0,
          backgroundNoise: 0,
        },
      },
      persistedSidecarSelection: {
        facts: [
          {
            id: 1,
            chapterNo: 18,
            chapterGap: 2,
            factType: "chapter_summary",
            factText: "林夜仍在追查黑铁令旧案。",
            rank: 1,
            score: 88,
            selected: true,
            selectedBy: "top_k",
            longTailCandidate: false,
            droppedReason: null,
            surfacedIn: ["blockingConstraints", "recentChanges"],
            trace: {
              keywordMatched: true,
              structuralManualMatch: false,
              keywordScore: 30,
              riskScore: 20,
              importanceScore: 18,
              recencyScore: 20,
              structuralBoost: 0,
            },
          },
        ],
        events: [
          {
            id: 2,
            chapterNo: 3,
            chapterGap: 17,
            title: "旧案回响",
            unresolvedImpact: "真正主谋仍未现身。",
            rank: 2,
            score: 76,
            selected: true,
            selectedBy: "long_tail_reserve",
            longTailCandidate: true,
            droppedReason: null,
            surfacedIn: ["blockingConstraints", "riskReminders"],
            trace: {
              keywordMatched: true,
              structuralManualMatch: false,
              keywordScore: 22,
              unresolvedScore: 18,
              recencyScore: 6,
              structuralBoost: 0,
            },
          },
        ],
      },
      candidates: {
        hooks: [],
        characters: [],
        factions: [],
        items: [],
        relations: [],
        worldSettings: [],
      },
      hardConstraints: {
        hooks: [],
        characters: [],
        factions: [],
        items: [],
        relations: [],
        worldSettings: [],
      },
      priorityContext: {
        blockingConstraints: [],
        decisionContext: [],
        supportingContext: [],
        backgroundNoise: [],
      },
    },
  }, { mode: "plan" });

  assert.equal(observed.observability.sections.mustFollowFacts.inputCount, 2);
  assert.equal(observed.observability.sections.mustFollowFacts.outputCount, 1);
  assert.equal(observed.observability.sections.mustFollowFacts.budgetDropped, 1);
  assert.equal(observed.observability.sections.mustFollowFacts.clippedCount, 1);
  assert.ok(observed.blocks.mustFollowFacts[0]?.endsWith("…"));
  assert.deepEqual(
    observed.observability.surfacedPersistedRefs.find((item) => item.section === "mustFollowFacts" && item.source.sourceType === "persisted_event" && item.source.sourceId === 2),
    {
      section: "mustFollowFacts",
      source: { sourceType: "persisted_event", sourceId: 2 },
      chapterGap: 17,
      selectedBy: "long_tail_reserve",
    },
  );
  assert.deepEqual(
    observed.observability.surfacedPersistedRefs.find((item) => item.section === "recentChanges" && item.source.sourceType === "persisted_fact" && item.source.sourceId === 1),
    {
      section: "recentChanges",
      source: { sourceType: "persisted_fact", sourceId: 1 },
      chapterGap: 2,
      selectedBy: "top_k",
    },
  );
});
