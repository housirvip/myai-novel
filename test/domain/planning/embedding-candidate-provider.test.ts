import assert from "node:assert/strict";
import test from "node:test";

import { EmbeddingCandidateProvider } from "../../../src/domain/planning/embedding-candidate-provider.js";
import type { RetrievalCandidateProvider } from "../../../src/domain/planning/retrieval-pipeline.js";

test("EmbeddingCandidateProvider merges semantic matches without replacing base candidates", async () => {
  const baseProvider: RetrievalCandidateProvider = {
    async loadCandidates() {
      return {
        outlines: [],
        recentChapters: [],
        entityGroups: {
          hooks: [],
          characters: [{ id: 1, name: "林夜", reason: "manual_id", content: "goal=调查", score: 100 }],
          factions: [],
          items: [],
          relations: [],
          worldSettings: [],
        },
      };
    },
  };

  const provider = new EmbeddingCandidateProvider(baseProvider, {
    async search() {
      return [
        {
          entityType: "character",
          entityId: 1,
          chunkKey: "character:1:summary",
          semanticScore: 0.91,
          text: "人物：林夜\n核心动机：调查旧案",
        },
        {
          entityType: "world_setting",
          entityId: 4,
          chunkKey: "world_setting:4:summary",
          semanticScore: 0.73,
          text: "设定：宗门制度\n规则摘要：外门弟子需持令牌登记",
        },
      ];
    },
  });

  const result = await provider.loadCandidates({} as never, {
    bookId: 1,
    chapterNo: 12,
    keywords: ["黑铁令", "旧案"],
    manualRefs: {
      characterIds: [],
      factionIds: [],
      itemIds: [],
      hookIds: [],
      relationIds: [],
      worldSettingIds: [],
    },
  });

  assert.equal(result.entityGroups.characters.length, 1);
  assert.equal(result.entityGroups.worldSettings.length, 1);
  assert.equal(result.entityGroups.worldSettings[0]?.reason, "embedding_match");
});
