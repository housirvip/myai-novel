import assert from "node:assert/strict";
import test from "node:test";

import { prioritizeFactPackets } from "../../../src/domain/planning/retrieval-priorities.js";

test("prioritizeFactPackets keeps manual and risky packets in blocking constraints", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "character",
      entityId: 1,
      displayName: "林夜",
      identity: ["林夜"],
      currentState: ["current_location=外门"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: ["人物或实体位置需要连续承接"],
      relevanceReasons: ["manual_id"],
      scores: {
        matchScore: 100,
        importanceScore: 0,
        continuityRiskScore: 1,
        recencyScore: 0,
        manualPriorityScore: 1,
        finalScore: 100,
      },
    },
    {
      entityType: "faction",
      entityId: 2,
      displayName: "青岳宗",
      identity: ["青岳宗"],
      currentState: ["维持山门稳定"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: [],
      relevanceReasons: ["keyword_hit"],
      scores: {
        matchScore: 25,
        importanceScore: 0,
        continuityRiskScore: 0,
        recencyScore: 0,
        manualPriorityScore: 0,
        finalScore: 25,
      },
    },
  ]);

  assert.equal(prioritized.blockingConstraints.length, 1);
  assert.equal(prioritized.blockingConstraints[0]?.displayName, "林夜");
  assert.equal(prioritized.supportingContext.length, 1);
});

test("prioritizeFactPackets upgrades motivation-relevant character hits into decision context", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "character",
      entityId: 2,
      displayName: "顾沉舟",
      identity: ["顾沉舟"],
      currentState: ["background=曾目睹同门背叛\ngoal=暗中观察黑铁令持有者"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: [],
      relevanceReasons: ["keyword_hit"],
      scores: {
        matchScore: 25,
        importanceScore: 0,
        continuityRiskScore: 0,
        recencyScore: 0,
        manualPriorityScore: 0,
        finalScore: 25,
      },
    },
  ]);

  assert.equal(prioritized.decisionContext.length, 1);
  assert.equal(prioritized.decisionContext[0]?.displayName, "顾沉舟");
});

test("prioritizeFactPackets upgrades rule-relevant factions into decision context", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "faction",
      entityId: 1,
      displayName: "青岳宗",
      identity: ["青岳宗"],
      currentState: ["category=宗门\ncore_goal=维持宗门秩序\ndescription=东境大宗门"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: [],
      relevanceReasons: ["keyword_hit"],
      scores: {
        matchScore: 25,
        importanceScore: 0,
        continuityRiskScore: 0,
        recencyScore: 0,
        manualPriorityScore: 0,
        finalScore: 25,
      },
    },
  ]);

  assert.equal(prioritized.decisionContext.length, 1);
  assert.equal(prioritized.decisionContext[0]?.displayName, "青岳宗");
});
