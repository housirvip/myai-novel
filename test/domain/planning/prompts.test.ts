import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovePrompt,
  buildDraftPrompt,
  buildIntentGenerationPrompt,
  buildPlanPrompt,
  buildRepairPrompt,
  buildReviewPrompt,
} from "../../../src/domain/planning/prompts.js";

test("intent generation prompt includes manual focus when provided", () => {
  const messages = buildIntentGenerationPrompt({
    bookTitle: "青岳入门录",
    chapterNo: 8,
    outlinesText: "- 内门试炼开启",
    recentChapterText: "- 第7章：黑铁令引发高层异常反应",
    manualFocusText: "人物：林夜；顾沉舟\n物品：黑铁令",
  });

  assert.match(messages[1]?.content ?? "", /用户显式指定的重点实体：/);
  assert.match(messages[1]?.content ?? "", /人物：林夜；顾沉舟/);
  assert.match(messages[1]?.content ?? "", /物品：黑铁令/);
});

test("repair prompt includes plan and retrieved context", () => {
  const messages = buildRepairPrompt({
    planContent: "本章要推进黑铁令线索。",
    draftContent: "这是当前草稿。",
    reviewContent: "{\"issues\":[\"设定冲突\"]}",
    intentConstraints: {
      intentSummary: "推进黑铁令线索",
      mustInclude: ["顾沉舟察觉异常"],
      mustAvoid: ["直接揭晓真相"],
    },
    retrievedContext: {
      characters: [{ id: 1, name: "林夜" }],
      worldSettings: [{ id: 2, title: "宗门制度" }],
    },
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[1]?.content ?? "", /章节规划：/);
  assert.match(messages[1]?.content ?? "", /本章要推进黑铁令线索/);
  assert.match(messages[1]?.content ?? "", /意图约束：/);
  assert.match(messages[1]?.content ?? "", /必须包含：顾沉舟察觉异常/);
  assert.match(messages[1]?.content ?? "", /必须避免：直接揭晓真相/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须保持一致）：/);
  assert.match(messages[1]?.content ?? "", /林夜/);
  assert.match(messages[1]?.content ?? "", /宗门制度/);
});

test("draft prompt treats retrieved context as hard constraints", () => {
  const messages = buildDraftPrompt({
    planContent: "本章推进林夜入宗，并强化黑铁令异常。",
    targetWords: 3000,
    intentConstraints: {
      mustInclude: ["黑铁令异常反应"],
      mustAvoid: ["主角无代价通关"],
    },
    retrievedContext: {
      hardConstraints: {
        characters: [{ id: 1, name: "林夜", content: "current_location=青岳宗外门" }],
      },
      riskReminders: [
        "注意人物当前位置连续性，避免人物在没有过渡的情况下突然更换场景。",
        "注意关键物品的持有者与状态连续性，避免无交代易主、失踪或突然恢复。",
      ],
      characters: [{ id: 1, name: "林夜", content: "personality=冷静谨慎" }],
    },
  });

  assert.match(messages[0]?.content ?? "", /硬约束/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须严格参考）/);
  assert.match(messages[1]?.content ?? "", /意图约束：/);
  assert.match(messages[1]?.content ?? "", /黑铁令异常反应/);
  assert.match(messages[1]?.content ?? "", /人物当前位置连续性/);
  assert.match(messages[1]?.content ?? "", /关键物品的持有者与状态连续性/);
  assert.match(messages[1]?.content ?? "", /只输出完整章节草稿正文/);
});

test("approve prompt includes retrieved context and finalization constraints", () => {
  const messages = buildApprovePrompt({
    planContent: "本章推进黑铁令线索。",
    draftContent: "当前草稿正文。",
    reviewContent: "{\"issues\":[\"节奏偏快\"]}",
    intentConstraints: {
      mustInclude: ["旧案线索推进"],
      mustAvoid: ["设定冲突"],
    },
    retrievedContext: {
      relations: [{ id: 1, content: "source=林夜 target=青岳宗 relation_type=member" }],
      worldSettings: [{ id: 2, title: "宗门制度" }],
    },
  });

  assert.match(messages[0]?.content ?? "", /召回上下文/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须保持一致）/);
  assert.match(messages[1]?.content ?? "", /意图约束：/);
  assert.match(messages[1]?.content ?? "", /林夜/);
  assert.match(messages[1]?.content ?? "", /定稿要求：/);
  assert.match(messages[1]?.content ?? "", /只输出最终文稿正文/);
});

test("plan prompt uses structured sections and explicit recall constraints", () => {
  const messages = buildPlanPrompt({
    bookTitle: "青岳入门录",
    chapterNo: 12,
    authorIntent: "本章让主角借黑铁令撬开外门局势。",
    intentConstraints: {
      intentSummary: "推进黑铁令线索并扩大宗门关注",
      mustInclude: ["顾沉舟试探"],
      mustAvoid: ["直接揭晓黑铁令来历"],
    },
    retrievedContext: {
      book: {
        id: 1,
        title: "青岳入门录",
        summary: null,
        targetChapterCount: 200,
        currentChapterCount: 11,
      },
      outlines: [],
      recentChapters: [],
      hooks: [],
      characters: [],
      factions: [],
      items: [],
      relations: [],
      worldSettings: [],
      riskReminders: ["注意承接上一章状态"],
    },
  });

  assert.match(messages[0]?.content ?? "", /有效约束/);
  assert.match(messages[1]?.content ?? "", /章节信息：/);
  assert.match(messages[1]?.content ?? "", /作者意图：/);
  assert.match(messages[1]?.content ?? "", /意图约束：/);
  assert.match(messages[1]?.content ?? "", /必须包含：顾沉舟试探/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须严格参考）/);
  assert.match(messages[1]?.content ?? "", /输出要求：/);
});

test("review prompt uses retrieved context as validation baseline", () => {
  const messages = buildReviewPrompt({
    planContent: "本章推进主角入宗。",
    draftContent: "章节草稿正文。",
    retrievedContext: {
      characters: [{ id: 1, name: "林夜", content: "status=alive" }],
      riskReminders: ["注意人物位置变化"],
    },
  });

  assert.match(messages[0]?.content ?? "", /核对基准/);
  assert.match(messages[1]?.content ?? "", /章节规划：/);
  assert.match(messages[1]?.content ?? "", /章节草稿：/);
  assert.match(messages[1]?.content ?? "", /召回上下文（作为核对基准）/);
  assert.match(messages[1]?.content ?? "", /输出要求：/);
  assert.match(messages[1]?.content ?? "", /summary, issues, risks, continuity_checks, repair_suggestions/);
});
