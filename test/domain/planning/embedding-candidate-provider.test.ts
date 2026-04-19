import assert from "node:assert/strict";
import test from "node:test";

import { EmbeddingCandidateProvider } from "../../../src/domain/planning/embedding-candidate-provider.js";
import { buildFactPacket } from "../../../src/domain/planning/fact-packet-builder.js";
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
          displayName: "林夜",
          text: "人物：林夜\n核心动机：调查旧案",
        },
        {
          entityType: "world_setting",
          entityId: 4,
          chunkKey: "world_setting:4:summary",
          semanticScore: 0.73,
          displayName: "宗门制度",
          text: "设定：宗门制度\n规则摘要：外门弟子需持令牌登记",
        },
      ];
    },
  });

  const result = await provider.loadCandidates({} as never, {
    bookId: 1,
    chapterNo: 12,
    keywords: ["黑铁令", "旧案"],
    queryText: "黑铁令 旧案 宗门制度",
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
  assert.equal(result.entityGroups.worldSettings[0]?.title, "宗门制度");
});

test("EmbeddingCandidateProvider preserves structured relation metadata for embedding-only matches", async () => {
  const baseProvider: RetrievalCandidateProvider = {
    async loadCandidates() {
      return {
        outlines: [],
        recentChapters: [],
        entityGroups: {
          hooks: [],
          characters: [],
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
          entityType: "relation",
          entityId: 9,
          chunkKey: "relation:9:summary",
          semanticScore: 0.82,
          displayName: "林夜 -> 顾沉舟",
          text: "关系：林夜 -> 顾沉舟\n关系类型：observer\n当前张力：互相试探",
          relationEndpoints: [
            { entityType: "character", entityId: 1, displayName: "林夜" },
            { entityType: "character", entityId: 2, displayName: "顾沉舟" },
          ],
          relationMetadata: {
            relationType: "observer",
            status: "互相试探",
            description: "因黑铁令线索产生试探",
            appendNotes: "关系不能突然缓和",
          },
        },
      ];
    },
  });

  const result = await provider.loadCandidates({} as never, {
    bookId: 1,
    chapterNo: 12,
    keywords: ["互相试探"],
    queryText: "林夜 顾沉舟 互相试探",
    manualRefs: {
      characterIds: [],
      factionIds: [],
      itemIds: [],
      hookIds: [],
      relationIds: [],
      worldSettingIds: [],
    },
  });

  const relation = result.entityGroups.relations[0];
  assert.equal(relation?.reason, "embedding_match");
  assert.deepEqual(relation?.relationEndpoints, [
    { entityType: "character", entityId: 1, displayName: "林夜" },
    { entityType: "character", entityId: 2, displayName: "顾沉舟" },
  ]);
  assert.deepEqual(relation?.relationMetadata, {
    relationType: "observer",
    status: "互相试探",
    description: "因黑铁令线索产生试探",
    appendNotes: "关系不能突然缓和",
  });

  const packet = buildFactPacket("relation", relation!);
  assert.deepEqual(packet.relationEndpoints, relation?.relationEndpoints);
  assert.deepEqual(packet.relationMetadata, relation?.relationMetadata);
  assert.deepEqual(packet.relatedDisplayNames, ["林夜", "顾沉舟"]);
});

test("EmbeddingCandidateProvider filters low-score embedding-only matches while keeping support for existing candidates", async () => {
  const baseProvider: RetrievalCandidateProvider = {
    async loadCandidates() {
      return {
        outlines: [],
        recentChapters: [],
        entityGroups: {
          hooks: [],
          characters: [{ id: 1, name: "林夜", reason: "keyword_hit", content: "goal=调查", score: 90 }],
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
        { entityType: "character", entityId: 1, chunkKey: "character:1:summary", semanticScore: 0.66, displayName: "林夜", text: "人物：林夜" },
        { entityType: "world_setting", entityId: 4, chunkKey: "world_setting:4:summary", semanticScore: 0.68, displayName: "宗门制度", text: "设定：宗门制度" },
      ];
    },
  }, {
    minScore: 0.64,
    minEmbeddingOnlyScore: 0.72,
  });

  const result = await provider.loadCandidates({} as never, {
    bookId: 1,
    chapterNo: 12,
    keywords: ["林夜"],
    queryText: "林夜 宗门制度",
    manualRefs: {
      characterIds: [],
      factionIds: [],
      itemIds: [],
      hookIds: [],
      relationIds: [],
      worldSettingIds: [],
    },
  });

  assert.match(result.entityGroups.characters[0]?.reason ?? "", /embedding_support/);
  assert.equal(result.entityGroups.worldSettings.length, 0);
});
