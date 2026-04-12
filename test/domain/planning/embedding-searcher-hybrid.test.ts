import assert from "node:assert/strict";
import test from "node:test";

import { DeterministicHashEmbeddingProvider } from "../../../src/domain/planning/embedding-provider.js";
import { HybridEmbeddingSearcher } from "../../../src/domain/planning/embedding-searcher-hybrid.js";

test("HybridEmbeddingSearcher keeps rule-focused world setting near the top", async () => {
  const searcher = new HybridEmbeddingSearcher(new DeterministicHashEmbeddingProvider());

  await searcher.index([
    {
      entityType: "character",
      entityId: 1,
      chunkKey: "character:1:summary",
      model: "test-embed-v1",
      text: "人物：林夜\n核心动机：查清黑铁令来历",
    },
    {
      entityType: "world_setting",
      entityId: 2,
      chunkKey: "world_setting:2:summary",
      model: "test-embed-v1",
      text: "设定：宗门制度\n规则摘要：外门弟子凭令牌登记入门",
    },
    {
      entityType: "faction",
      entityId: 3,
      chunkKey: "faction:3:summary",
      model: "test-embed-v1",
      text: "势力：青岳宗\n规则执行：负责外门弟子凭令牌登记入门",
    },
  ]);

  const matches = await searcher.search({ queryText: "规则 令牌 登记", limit: 2 });

  assert.equal(matches.length, 2);
  assert.ok(matches.some((match) => match.entityType === "world_setting" && match.entityId === 2));
});
