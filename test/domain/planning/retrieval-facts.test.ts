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

test("buildPriorityContext propagates relation endpoints into decision context", () => {
  const context = buildPriorityContext({
    hardConstraints: {
      characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 40 }],
      factions: [{ id: 2, name: "青岳宗", reason: "keyword_hit", content: "category=宗门", score: 30 }],
      hooks: [],
      items: [],
      relations: [],
      worldSettings: [],
    },
    softReferences: {
      relations: [{ id: 5, reason: "keyword_hit", content: "source=林夜 (character:1)\ntarget=青岳宗 (faction:2)\nrelation_type=member", score: 60 }],
      characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 40 }],
      factions: [{ id: 2, name: "青岳宗", reason: "keyword_hit", content: "category=宗门", score: 30 }],
      hooks: [],
      items: [],
      worldSettings: [],
    },
  });

  assert.ok(context.decisionContext.some((packet) => packet.displayName === "青岳宗"));
  assert.ok(context.blockingConstraints.some((packet) => packet.displayName === "林夜"));
  const factionPacket = context.decisionContext.find((packet) => packet.displayName === "青岳宗");
  assert.ok(factionPacket?.currentState.some((line) => line.includes("relation_context=与林夜")));
  assert.ok(context.blockingConstraints.some((packet) => packet.displayName === "青岳宗" || packet.displayName === "林夜"));
});

test("buildPriorityContext expands hard facts for member relations", () => {
  const context = buildPriorityContext({
    hardConstraints: {
      characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 40 }],
      items: [{ id: 7, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character\nowner_id=1\nstatus=active", score: 35 }],
      worldSettings: [{ id: 8, title: "宗门制度", reason: "keyword_hit", content: "category=规则\ncontent=外门弟子凭令牌登记入门", score: 30 }],
      factions: [{ id: 2, name: "青岳宗", reason: "keyword_hit", content: "category=宗门", score: 30 }],
      hooks: [],
      relations: [],
    },
    softReferences: {
      relations: [{ id: 5, reason: "keyword_hit", content: "source=林夜 (character:1)\ntarget=青岳宗 (faction:2)\nrelation_type=member\nstatus=active", score: 60 }],
      characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 40 }],
      factions: [{ id: 2, name: "青岳宗", reason: "keyword_hit", content: "category=宗门", score: 30 }],
      items: [{ id: 7, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character\nowner_id=1\nstatus=active", score: 35 }],
      worldSettings: [{ id: 8, title: "宗门制度", reason: "keyword_hit", content: "category=规则\ncontent=外门弟子凭令牌登记入门", score: 30 }],
      hooks: [],
    },
  });

  assert.ok(context.blockingConstraints.some((packet) => packet.displayName === "黑铁令"));
  assert.ok(context.blockingConstraints.some((packet) => packet.displayName === "宗门制度"));
});
