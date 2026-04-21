import assert from "node:assert/strict";
import test from "node:test";

import { buildDraftContextView } from "../../../src/domain/planning/context-views.js";

test("context views normalize legacy and new risk reminder provenance shapes", () => {
  const view = buildDraftContextView({
    riskReminders: [
      "纯字符串提醒",
      { text: "单来源提醒", sourceRef: { sourceType: "persisted_fact", sourceId: 1 } },
      { text: "多来源提醒", sourceRefs: [
        { sourceType: "persisted_fact", sourceId: 2 },
        { sourceType: "persisted_event", sourceId: 3 },
      ] },
    ],
  });

  assert.equal(view.riskReminders[0]?.text, "纯字符串提醒");
  assert.equal(view.riskReminders[0]?.sourceRefs, undefined);
  assert.equal(view.riskReminders[1]?.sourceRef?.sourceId, 1);
  assert.equal(view.riskReminders[1]?.sourceRefs?.length, 1);
  assert.equal(view.riskReminders[2]?.sourceRefs?.length, 2);
  assert.equal(view.riskReminders[2]?.sourceRef?.sourceId, 2);
});

test("context views normalize recentChanges provenance shapes", () => {
  const view = buildDraftContextView({
    recentChanges: [
      { source: "risk_reminder", label: "高风险提醒1", detail: "提醒", priority: 100, sourceRef: { sourceType: "persisted_fact", sourceId: 1 } },
      { source: "retrieval_fact", label: "第8章事实", detail: "旧案未收束", priority: 90, sourceRefs: [
        { sourceType: "persisted_fact", sourceId: 2 },
        { sourceType: "persisted_event", sourceId: 3 },
      ] },
    ],
  });

  assert.equal(view.recentChanges?.[0]?.sourceRefs?.length, 1);
  assert.equal(view.recentChanges?.[0]?.sourceRef?.sourceId, 1);
  assert.equal(view.recentChanges?.[1]?.sourceRefs?.length, 2);
  assert.equal(view.recentChanges?.[1]?.sourceRef?.sourceId, 2);
});

test("context views normalize priorityContext packet provenance shapes", () => {
  const view = buildDraftContextView({
    priorityContext: {
      blockingConstraints: [
        {
          entityType: "chapter",
          entityId: -1,
          displayName: "第8章事实",
          identity: ["chapter_summary"],
          currentState: ["旧案未收束"],
          coreConflictOrGoal: [],
          recentChanges: [],
          continuityRisk: [],
          relevanceReasons: ["persisted_fact"],
          sourceRefs: [
            { sourceType: "persisted_fact", sourceId: 1 },
            { sourceType: "persisted_event", sourceId: 2 },
            { sourceType: "persisted_fact", sourceId: 1 },
          ],
          scores: {
            matchScore: 90,
            importanceScore: 90,
            continuityRiskScore: 88,
            recencyScore: 48,
            manualPriorityScore: 0,
            finalScore: 90,
          },
        },
      ],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
  });

  assert.equal(view.priorityContext?.blockingConstraints[0]?.sourceRef?.sourceType, "persisted_fact");
  assert.equal(view.priorityContext?.blockingConstraints[0]?.sourceRef?.sourceId, 1);
  assert.equal(view.priorityContext?.blockingConstraints[0]?.sourceRefs?.length, 2);
  assert.equal(view.priorityContext?.blockingConstraints[0]?.sourceRefs?.[1]?.sourceType, "persisted_event");
  assert.equal(view.priorityContext?.blockingConstraints[0]?.sourceRefs?.[1]?.sourceId, 2);
});
