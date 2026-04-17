import assert from "node:assert/strict";
import test from "node:test";

import { classifyPriorityPacket, prioritizeFactPackets } from "../../../src/domain/planning/retrieval-priorities.js";

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

test("prioritizeFactPackets does not upgrade generic active factions without rule intent", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "faction",
      entityId: 3,
      displayName: "山海盟",
      identity: ["山海盟"],
      currentState: ["category=宗门\ndescription=沿海宗门\nstatus=active"],
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

  assert.equal(prioritized.decisionContext.length, 0);
  assert.equal(prioritized.supportingContext.length, 1);
});

test("prioritizeFactPackets keeps institution-context factions in decision context", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "faction",
      entityId: 4,
      displayName: "青岳宗",
      identity: ["青岳宗"],
      currentState: ["category=宗门\ndescription=东境宗门"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: [],
      relevanceReasons: ["institution_context"],
      scores: {
        matchScore: 18,
        importanceScore: 0,
        continuityRiskScore: 0,
        recencyScore: 0,
        manualPriorityScore: 0,
        finalScore: 18,
      },
    },
  ]);

  assert.equal(prioritized.decisionContext.length, 1);
  assert.equal(prioritized.decisionContext[0]?.displayName, "青岳宗");
});

test("prioritizeFactPackets upgrades continuity-risk factions into blocking constraints", () => {
  const prioritized = prioritizeFactPackets([
    {
      entityType: "faction",
      entityId: 5,
      displayName: "青岳宗",
      identity: ["青岳宗"],
      currentState: ["category=宗门\ncore_goal=维持宗门秩序\ndescription=负责外门处理"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: [],
      relevanceReasons: ["continuity_risk"],
      scores: {
        matchScore: 18,
        importanceScore: 0,
        continuityRiskScore: 0,
        recencyScore: 0,
        manualPriorityScore: 0,
        finalScore: 18,
      },
    },
  ]);

  assert.equal(prioritized.blockingConstraints.length, 1);
  assert.equal(prioritized.blockingConstraints[0]?.displayName, "青岳宗");
});

test("classifyPriorityPacket returns bucket and assignment reasons", () => {
  const classification = classifyPriorityPacket({
    entityType: "character",
    entityId: 1,
    displayName: "林夜",
    identity: ["林夜"],
    currentState: ["current_location=外门", "goal=查清黑铁令来历"],
    coreConflictOrGoal: [],
    recentChanges: [],
    continuityRisk: ["人物或实体位置需要连续承接"],
    relevanceReasons: ["keyword_hit", "continuity_risk"],
    scores: {
      matchScore: 55,
      importanceScore: 0,
      continuityRiskScore: 1,
      recencyScore: 0,
      manualPriorityScore: 0,
      finalScore: 55,
    },
  });

  assert.equal(classification.bucket, "blockingConstraints");
  assert.ok(classification.assignedBy.includes("continuity_risk"));
  assert.ok(classification.assignedBy.includes("character_state_constraint"));
});
