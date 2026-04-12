import assert from "node:assert/strict";
import test from "node:test";

import { buildRecentChanges } from "../../../src/domain/planning/recent-changes.js";

test("buildRecentChanges prioritizes risk reminders and stateful entities", () => {
  const changes = buildRecentChanges({
    recentChapters: [
      { id: 1, chapterNo: 11, title: "黑铁令异动", summary: "林夜被迫持令入门。", status: "approved" },
    ],
    riskReminders: ["注意关键物品的持有者与状态连续性"],
    entities: [
      { id: 7, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character\nowner_id=1", score: 25 },
    ],
  });

  assert.equal(changes[0]?.source, "risk_reminder");
  assert.ok(changes.some((item) => item.source === "entity_state"));
  assert.ok(changes.some((item) => item.detail.includes("林夜被迫持令入门")));
});
