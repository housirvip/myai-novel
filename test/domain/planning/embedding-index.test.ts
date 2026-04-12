import assert from "node:assert/strict";
import test from "node:test";

import { buildEmbeddingDocuments } from "../../../src/domain/planning/embedding-index.js";

test("buildEmbeddingDocuments creates summary documents for MVP entity types", () => {
  const documents = buildEmbeddingDocuments({
    model: "test-embed-v1",
    characters: [
      { id: 1, name: "林夜", goal: "查清黑铁令来历", background: "寒门出身" },
    ],
    hooks: [
      { id: 2, title: "黑铁令身份核验", expected_payoff: "第五章触发" },
    ],
    worldSettings: [
      { id: 3, title: "宗门制度", category: "规则", content: "外门弟子凭令牌登记入门" },
    ],
  });

  assert.equal(documents.length, 3);
  assert.deepEqual(
    documents.map((item) => item.chunkKey),
    ["character:1:summary", "hook:2:summary", "world_setting:3:summary"],
  );
  assert.match(documents[0]?.text ?? "", /林夜/);
  assert.match(documents[2]?.text ?? "", /宗门制度/);
});
