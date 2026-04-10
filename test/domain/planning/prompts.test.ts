import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovePrompt,
  buildDraftPrompt,
  buildPlanPrompt,
  buildRepairPrompt,
  buildReviewPrompt,
} from "../../../src/domain/planning/prompts.js";

test("repair prompt includes plan and retrieved context", () => {
  const messages = buildRepairPrompt({
    planContent: "本章要推进黑铁令线索。",
    draftContent: "这是当前草稿。",
    reviewContent: "{\"issues\":[\"设定冲突\"]}",
    retrievedContext: {
      characters: [{ id: 1, name: "林夜" }],
      worldSettings: [{ id: 2, title: "宗门制度" }],
    },
  });

  assert.equal(messages[0]?.role, "system");
  assert.match(messages[1]?.content ?? "", /章节规划：/);
  assert.match(messages[1]?.content ?? "", /本章要推进黑铁令线索/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须保持一致）：/);
  assert.match(messages[1]?.content ?? "", /林夜/);
  assert.match(messages[1]?.content ?? "", /宗门制度/);
});

test("draft prompt treats retrieved context as hard constraints", () => {
  const messages = buildDraftPrompt({
    planContent: "本章推进林夜入宗，并强化黑铁令异常。",
    targetWords: 3000,
    retrievedContext: {
      riskReminders: ["注意不要违反宗门制度"],
      characters: [{ id: 1, name: "林夜", content: "personality=冷静谨慎" }],
    },
  });

  assert.match(messages[0]?.content ?? "", /硬约束/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须严格参考）/);
  assert.match(messages[1]?.content ?? "", /风险提醒/);
  assert.match(messages[1]?.content ?? "", /只输出完整章节草稿正文/);
});

test("approve prompt includes retrieved context and finalization constraints", () => {
  const messages = buildApprovePrompt({
    planContent: "本章推进黑铁令线索。",
    draftContent: "当前草稿正文。",
    reviewContent: "{\"issues\":[\"节奏偏快\"]}",
    retrievedContext: {
      relations: [{ id: 1, content: "source=林夜 target=青岳宗 relation_type=member" }],
      worldSettings: [{ id: 2, title: "宗门制度" }],
    },
  });

  assert.match(messages[0]?.content ?? "", /召回上下文/);
  assert.match(messages[1]?.content ?? "", /召回上下文（必须保持一致）/);
  assert.match(messages[1]?.content ?? "", /林夜/);
  assert.match(messages[1]?.content ?? "", /定稿要求：/);
  assert.match(messages[1]?.content ?? "", /只输出最终文稿正文/);
});

test("plan prompt uses structured sections and explicit recall constraints", () => {
  const messages = buildPlanPrompt({
    bookTitle: "青岳入门录",
    chapterNo: 12,
    authorIntent: "本章让主角借黑铁令撬开外门局势。",
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
});
