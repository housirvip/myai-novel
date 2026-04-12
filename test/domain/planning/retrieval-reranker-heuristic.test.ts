import assert from "node:assert/strict";
import test from "node:test";

import { HeuristicReranker } from "../../../src/domain/planning/retrieval-reranker-heuristic.js";

test("HeuristicReranker prefers continuity-heavy entities and preserves candidates", async () => {
  const reranker = new HeuristicReranker();
  const result = await reranker.rerank({
    params: {
      bookId: 1,
      chapterNo: 5,
      keywords: ["黑铁令", "林夜"],
      manualRefs: {
        characterIds: [],
        factionIds: [],
        itemIds: [],
        hookIds: [],
        relationIds: [],
        worldSettingIds: [],
      },
    },
    candidates: {
      outlines: [],
      recentChapters: [],
      entityGroups: {
        hooks: [
          { id: 1, title: "远期伏笔", reason: "keyword_hit", content: "target_chapter_no=9", score: 50 },
          { id: 2, title: "临近伏笔", reason: "keyword_hit", content: "target_chapter_no=5\nexpected_payoff=本章触发", score: 50 },
        ],
        characters: [
          { id: 1, name: "顾沉舟", reason: "keyword_hit", content: "background=宗门弟子", score: 50 },
          { id: 2, name: "林夜", reason: "keyword_hit", content: "current_location=外门\ngoal=调查黑铁令", score: 50 },
        ],
        factions: [],
        items: [],
        relations: [],
        worldSettings: [],
      },
    },
  });

  assert.equal(result.entityGroups.characters.length, 2);
  assert.equal(result.entityGroups.hooks.length, 2);
  assert.equal(result.entityGroups.characters[0]?.name, "林夜");
  assert.equal(result.entityGroups.hooks[0]?.title, "临近伏笔");
});
