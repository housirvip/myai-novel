import assert from "node:assert/strict";
import test from "node:test";

import {
  createFactPacketWithProvenance,
  createPersistedEventRef,
  createPersistedFactRef,
  createRecentChangeWithProvenance,
  createRiskReminderWithProvenance,
  hasPersistedSourceRef,
} from "../../../src/domain/planning/provenance.js";

test("provenance helpers create canonical persisted refs and normalized entries", () => {
  const factRef = createPersistedFactRef(1);
  const eventRef = createPersistedEventRef(2);

  const reminder = createRiskReminderWithProvenance({
    text: "注意承接既有事实：黑铁令旧案尚未收束。",
    sourceRefs: [factRef, eventRef],
  });

  const change = createRecentChangeWithProvenance({
    source: "risk_reminder",
    label: "高风险提醒1",
    detail: "黑铁令旧案尚未收束。",
    priority: 100,
    sourceRefs: [factRef, eventRef],
  });

  assert.equal(reminder.sourceRef?.sourceId, 1);
  assert.equal(reminder.sourceRefs?.length, 2);
  assert.equal(change.sourceRef?.sourceId, 1);
  assert.equal(change.sourceRefs?.length, 2);
  assert.equal(hasPersistedSourceRef(reminder, "persisted_event", 2), true);
  assert.equal(hasPersistedSourceRef(change, "persisted_fact", 1), true);
});

test("provenance helpers normalize fact packet provenance and support packet ref lookup", () => {
  const factRef = createPersistedFactRef(7);
  const eventRef = createPersistedEventRef(9);

  const packet = createFactPacketWithProvenance({
    entityType: "chapter",
    entityId: -7,
    displayName: "第7章事实",
    identity: ["chapter_summary"],
    currentState: ["旧案未收束"],
    coreConflictOrGoal: [],
    recentChanges: [],
    continuityRisk: [],
    relevanceReasons: ["persisted_fact"],
    sourceRefs: [factRef, eventRef, factRef],
    scores: {
      matchScore: 80,
      importanceScore: 80,
      continuityRiskScore: 70,
      recencyScore: 60,
      manualPriorityScore: 0,
      finalScore: 80,
    },
  });

  assert.equal(packet.sourceRef?.sourceType, "persisted_fact");
  assert.equal(packet.sourceRef?.sourceId, 7);
  assert.equal(packet.sourceRefs?.length, 2);
  assert.equal(hasPersistedSourceRef(packet, "persisted_fact", 7), true);
  assert.equal(hasPersistedSourceRef(packet, "persisted_event", 9), true);
});
