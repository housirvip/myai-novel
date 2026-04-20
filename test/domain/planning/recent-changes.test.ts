import assert from "node:assert/strict";
import test from "node:test";

import { buildRecentChanges } from "../../../src/domain/planning/recent-changes.js";

test("buildRecentChanges prioritizes risk reminders and stateful entities", () => {
  const changes = buildRecentChanges({
    recentChapters: [
      { id: 1, chapterNo: 11, title: "黑铁令异动", summary: "林夜被迫持令入门。", status: "approved" },
    ],
    riskReminders: [{ text: "注意关键物品的持有者与状态连续性" }],
    entities: [
      { id: 7, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character\nowner_id=1", score: 25 },
    ],
  });

  assert.equal(changes[0]?.source, "risk_reminder");
  assert.ok(changes.some((item) => item.source === "entity_state"));
  assert.ok(changes.some((item) => item.detail.includes("林夜被迫持令入门")));
});

test("buildRecentChanges keeps more recent chapters ahead of older ones in carryover ordering", () => {
  const changes = buildRecentChanges({
    recentChapters: [
      { id: 9, chapterNo: 119, title: "第一百一十九章", summary: "最新承接", status: "approved" },
      { id: 8, chapterNo: 118, title: "第一百一十八章", summary: "次新承接", status: "approved" },
      { id: 7, chapterNo: 117, title: "第一百一十七章", summary: "更早承接", status: "approved" },
    ],
  });

  const chapterChanges = changes.filter((item) => item.source === "chapter_summary");
  assert.equal(chapterChanges[0]?.label, "第119章承接");
  assert.equal(chapterChanges[1]?.label, "第118章承接");
  assert.equal(chapterChanges[2]?.label, "第117章承接");
});

test("buildRecentChanges includes persisted facts and story events ahead of plain chapter carryover", () => {
  const changes = buildRecentChanges({
    recentChapters: [
      { id: 9, chapterNo: 119, title: "第一百一十九章", summary: "最近一章承接", status: "approved" },
    ],
    persistedFacts: [
      { id: 1, chapterNo: 87, factType: "chapter_summary", factText: "黑铁令旧案仍未收束。", importance: 90, riskLevel: 85 },
    ],
    persistedEvents: [
      { id: 2, chapterNo: 101, title: "旧案再浮现", summary: "档案库再次提到旧案。", unresolvedImpact: "仍需确认黑铁副令来源。" },
    ],
  });

  assert.equal(changes[0]?.source, "retrieval_fact");
  assert.ok(changes.some((item) => item.source === "story_event"));
  assert.ok(changes.some((item) => item.source === "chapter_summary"));
});
