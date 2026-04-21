import assert from "node:assert/strict";
import test from "node:test";

import { dedupePackets } from "../../../src/domain/planning/fact-packet-merge.js";

test("dedupePackets preserves merged packet provenance refs", () => {
  const packets = dedupePackets([
    {
      entityType: "chapter",
      entityId: -1,
      displayName: "第8章事实",
      identity: ["chapter_summary"],
      currentState: ["旧案未收束"],
      coreConflictOrGoal: [],
      recentChanges: [],
      continuityRisk: ["高风险已知事实需要承接"],
      relevanceReasons: ["persisted_fact"],
      sourceRef: { sourceType: "persisted_fact", sourceId: 1 },
      scores: {
        matchScore: 90,
        importanceScore: 90,
        continuityRiskScore: 88,
        recencyScore: 48,
        manualPriorityScore: 0,
        finalScore: 90,
      },
    },
    {
      entityType: "chapter",
      entityId: -1,
      displayName: "第8章事实",
      identity: ["story_event"],
      currentState: ["副令来源仍未查清"],
      coreConflictOrGoal: ["确认副令来源"],
      recentChanges: [],
      continuityRisk: ["未收束事件需要持续承接"],
      relevanceReasons: ["persisted_event"],
      sourceRefs: [
        { sourceType: "persisted_fact", sourceId: 1 },
        { sourceType: "persisted_event", sourceId: 2 },
      ],
      scores: {
        matchScore: 72,
        importanceScore: 60,
        continuityRiskScore: 70,
        recencyScore: 47,
        manualPriorityScore: 0,
        finalScore: 72,
      },
    },
  ]);

  assert.equal(packets.length, 1);
  assert.equal(packets[0]?.sourceRef?.sourceType, "persisted_fact");
  assert.equal(packets[0]?.sourceRef?.sourceId, 1);
  assert.equal(packets[0]?.sourceRefs?.length, 2);
  assert.ok(packets[0]?.sourceRefs?.some((source) => source.sourceType === "persisted_fact" && source.sourceId === 1));
  assert.ok(packets[0]?.sourceRefs?.some((source) => source.sourceType === "persisted_event" && source.sourceId === 2));
});
