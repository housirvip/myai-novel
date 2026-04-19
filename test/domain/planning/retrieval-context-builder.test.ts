import assert from "node:assert/strict";
import test from "node:test";

import { buildRetrievedContext } from "../../../src/domain/planning/retrieval-context-builder.js";
import type { RetrievalCandidateBundle, RetrievalRerankerOutput } from "../../../src/domain/planning/retrieval-pipeline.js";
import type { RetrievedEntity } from "../../../src/domain/planning/types.js";

test("buildRetrievedContext assembles top-level, soft references and derived context consistently", () => {
  const reranked: RetrievalRerankerOutput = {
    outlines: [
      { id: 1, title: "外门试炼", reason: "outline_hit", content: "main_plot=外门考核升级" },
    ],
    recentChapters: [
      { id: 10, chapterNo: 10, title: "第十章", summary: "林夜持令入门。", status: "approved" },
    ],
    entityGroups: {
      hooks: [createEntity({ id: 2, title: "黑铁令旧案", reason: "chapter_proximity", content: "target_chapter_no=11", score: 60 })],
      characters: [createEntity({ id: 3, name: "林夜", reason: "keyword_hit+continuity_risk", content: "current_location=青岳宗外门\ngoal=调查黑铁令", score: 80 })],
      factions: [createEntity({ id: 4, name: "青岳宗", reason: "institution_context", content: "category=宗门", score: 30 })],
      items: [createEntity({ id: 5, name: "黑铁令", reason: "keyword_hit+continuity_risk", content: "owner_type=character\nowner_id=3\nstatus=active", score: 55 })],
      relations: [createEntity({
        id: 6,
        reason: "keyword_hit",
        content: "source=林夜 (character:3)\ntarget=青岳宗 (faction:4)\nrelation_type=member",
        score: 50,
        relationEndpoints: [
          { entityType: "character", entityId: 3, displayName: "林夜" },
          { entityType: "faction", entityId: 4, displayName: "青岳宗" },
        ],
        relationMetadata: { relationType: "member", status: "active", description: "林夜入宗" },
      })],
      worldSettings: [createEntity({ id: 7, title: "宗门制度", reason: "keyword_hit", content: "category=规则\ncontent=外门弟子需持令牌登记", score: 45 })],
    },
  };
  const candidates: RetrievalCandidateBundle = {
    ...reranked,
    stats: {
      recentChaptersScanned: 5,
    },
  };

  const context = buildRetrievedContext({
    params: {
      bookId: 99,
      chapterNo: 11,
      keywords: ["黑铁令", "规则"],
      queryText: "黑铁令 规则",
      manualRefs: {
        characterIds: [],
        factionIds: [],
        itemIds: [],
        hookIds: [],
        relationIds: [],
        worldSettingIds: [],
      },
    },
    book: {
      id: 99,
      title: "青岳入门录",
      summary: "少年持令入宗。",
      target_chapter_count: 200,
      current_chapter_count: 10,
    },
    candidates,
    reranked,
  });

  assert.equal(context.book.title, "青岳入门录");
  assert.equal(context.book.targetChapterCount, 200);
  assert.equal(context.outlines[0], reranked.outlines[0]);
  assert.equal(context.characters[0], reranked.entityGroups.characters[0]);
  assert.equal(context.softReferences.outlines[0], reranked.outlines[0]);
  assert.equal(context.softReferences.entities.items[0], reranked.entityGroups.items[0]);
  assert.ok(context.hardConstraints.characters.some((item) => item.id === 3));
  assert.ok(context.hardConstraints.items.some((item) => item.id === 5));
  assert.ok(context.hardConstraints.worldSettings.some((item) => item.id === 7));
  assert.ok(context.riskReminders.some((item) => item.includes("接近回收节点的重要钩子")));
  assert.ok(context.riskReminders.some((item) => item.includes("人物当前位置连续性")));
  assert.ok(context.priorityContext?.blockingConstraints.some((packet) => packet.displayName === "林夜"));
  assert.ok(context.priorityContext?.decisionContext.some((packet) => packet.displayName === "青岳宗"));
    assert.equal(context.retrievalObservability?.candidates.characters[0]?.source, "rule");
   assert.equal(context.retrievalObservability?.query.chapterNo, 11);
   assert.equal(context.retrievalObservability?.candidateVolumes.recentChaptersScanned, 5);
   assert.equal(context.retrievalObservability?.candidateVolumes.recentChaptersKept, 1);
   assert.equal(context.retrievalObservability?.retention.hardConstraintPromotionCounts.characters.promoted > 0, true);
   assert.ok(context.retrievalObservability?.hardConstraints.characters[0]?.selectedBy.length);
   assert.ok(context.retrievalObservability?.priorityContext.blockingConstraints.some((packet) => packet.displayName === "林夜"));
   assert.ok(context.recentChanges?.some((item) => item.source === "risk_reminder"));
  assert.ok(context.recentChanges?.some((item) => item.source === "chapter_summary"));
});

function createEntity(input: Partial<RetrievedEntity> & { id: number }): RetrievedEntity {
  return {
    id: input.id,
    name: input.name,
    title: input.title,
    reason: input.reason ?? "keyword_hit",
    content: input.content ?? "",
    score: input.score ?? 0,
    relationEndpoints: input.relationEndpoints,
    relationMetadata: input.relationMetadata,
  };
}
