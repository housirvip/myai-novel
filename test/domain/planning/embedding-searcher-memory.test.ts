import assert from "node:assert/strict";
import test from "node:test";

import { buildEmbeddingDocuments } from "../../../src/domain/planning/embedding-index.js";
import { DeterministicHashEmbeddingProvider } from "../../../src/domain/planning/embedding-provider.js";
import { InMemoryEmbeddingSearcher } from "../../../src/domain/planning/embedding-searcher-memory.js";

test("InMemoryEmbeddingSearcher returns target rule document near the top for overlapping terms", async () => {
  const provider = new DeterministicHashEmbeddingProvider();
  const searcher = new InMemoryEmbeddingSearcher(provider);

  await searcher.index(
    buildEmbeddingDocuments({
      model: "test-embed-v1",
      characters: [
        { id: 1, name: "林夜", goal: "查清黑铁令来历", background: "寒门出身" },
      ],
      hooks: [
        { id: 2, title: "黑铁令身份核验", expected_payoff: "执事将在第五章进行身份核验" },
      ],
      worldSettings: [
        { id: 3, title: "宗门制度", category: "规则", content: "外门弟子凭令牌登记入门" },
      ],
    }),
  );

  const matches = await searcher.search({ queryText: "外门弟子 令牌 登记 入门", limit: 2 });

  assert.equal(matches.length, 2);
  assert.ok(matches.some((match) => match.entityType === "world_setting" && match.entityId === 3));
  assert.ok((matches.find((match) => match.entityType === "world_setting" && match.entityId === 3)?.semanticScore ?? 0) > 0);
});
