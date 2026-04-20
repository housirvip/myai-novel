import assert from "node:assert/strict";
import test from "node:test";

import { buildRiskReminders } from "../../../src/domain/planning/retrieval-risk-reminders.js";
import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "../../../src/domain/planning/types.js";

test("buildRiskReminders emits reminders for recent chapters, proximity hooks and continuity entities", () => {
  const reminders = buildRiskReminders({
    recentChapters: [
      { id: 1, chapterNo: 4, title: "第四章", summary: "黑铁令异动", status: "approved" },
    ],
    hardConstraints: createGroups({
      hooks: [createEntity({ id: 1, title: "临近伏笔", reason: "chapter_proximity", content: "target_chapter_no=5" })],
      characters: [createEntity({ id: 2, name: "林夜", content: "current_location=青岳宗外门" })],
      items: [createEntity({ id: 3, name: "黑铁令", content: "owner_type=character\nowner_id=1\nstatus=active" })],
      worldSettings: [createEntity({ id: 4, title: "宗门制度", content: "category=规则" })],
    }),
  });

  assert.ok(reminders.some((item) => item.text.includes("接近回收节点的重要钩子")));
  assert.ok(reminders.some((item) => item.text.includes("最近 1 章")));
  assert.ok(reminders.some((item) => item.text.includes("人物当前位置连续性")));
  assert.ok(reminders.some((item) => item.text.includes("关键物品的持有者与状态连续性")));
  assert.ok(reminders.some((item) => item.text.includes("已激活的世界规则")));
});

test("buildRiskReminders dedupes repeated reminder categories", () => {
  const reminders = buildRiskReminders({
    recentChapters: [],
    hardConstraints: createGroups({
      items: [
        createEntity({ id: 1, name: "黑铁令", content: "owner_type=character\nstatus=active" }),
        createEntity({ id: 2, name: "青铜令", content: "owner_type=character\nstatus=active" }),
      ],
    }),
  });

  assert.equal(reminders.filter((item) => item.text.includes("关键物品的持有者与状态连续性")).length, 1);
});

function createGroups(input: Partial<PlanRetrievedContextEntityGroups>): PlanRetrievedContextEntityGroups {
  return {
    hooks: input.hooks ?? [],
    characters: input.characters ?? [],
    factions: input.factions ?? [],
    items: input.items ?? [],
    relations: input.relations ?? [],
    worldSettings: input.worldSettings ?? [],
  };
}

function createEntity(input: Partial<RetrievedEntity> & { id: number }): RetrievedEntity {
  return {
    id: input.id,
    name: input.name,
    title: input.title,
    reason: input.reason ?? "keyword_hit",
    content: input.content ?? "",
    score: input.score ?? 0,
  };
}
