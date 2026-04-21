import assert from "node:assert/strict";
import test from "node:test";

import {
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
