import assert from "node:assert/strict";
import test from "node:test";

import { buildFactPacket, buildPriorityContext } from "../../../src/domain/planning/retrieval-facts.js";

test("buildFactPacket keeps explainability and infers continuity risk hints", () => {
  const packet = buildFactPacket("item", {
    id: 7,
    name: "黑铁令",
    reason: "manual_id+keyword_hit",
    content: "owner_type=character\nowner_id=1\ndescription=身份凭证",
    score: 125,
  });

  assert.equal(packet.displayName, "黑铁令");
  assert.deepEqual(packet.relevanceReasons, ["manual_id", "keyword_hit"]);
  assert.ok(packet.currentState[0]?.includes("owner_type=character"));
  assert.ok(packet.continuityRisk.some((item) => item.includes("持有状态")));
  assert.equal(packet.scores.finalScore, 125);
});

test("buildPriorityContext keeps hard constraints ahead of soft references", () => {
  const context = buildPriorityContext({
    hardConstraints: {
      characters: [{ id: 1, name: "林夜", reason: "manual_id", content: "current_location=外门", score: 100 }],
      hooks: [],
      factions: [],
      items: [],
      relations: [],
      worldSettings: [],
    },
    softReferences: {
      characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "goal=调查旧案", score: 25 }],
      worldSettings: [{ id: 4, title: "宗门制度", reason: "keyword_hit", content: "规则边界", score: 25 }],
      hooks: [],
      factions: [],
      items: [],
      relations: [],
    },
  });

  assert.equal(context.blockingConstraints.length, 1);
  assert.equal(context.blockingConstraints[0]?.displayName, "林夜");
  assert.equal(context.decisionContext.length, 1);
  assert.equal(context.decisionContext[0]?.displayName, "宗门制度");
});
