import assert from "node:assert/strict";
import test from "node:test";

import { buildRepairPrompt } from "../../../src/domain/planning/prompts.js";

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
  assert.match(messages[1]?.content ?? "", /召回上下文：/);
  assert.match(messages[1]?.content ?? "", /林夜/);
  assert.match(messages[1]?.content ?? "", /宗门制度/);
});
