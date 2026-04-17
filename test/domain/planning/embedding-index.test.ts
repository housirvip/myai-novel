import assert from "node:assert/strict";
import test from "node:test";

import { buildEmbeddingDocuments } from "../../../src/domain/planning/embedding-index.js";

test("buildEmbeddingDocuments creates summary documents for supported entity types", () => {
  const documents = buildEmbeddingDocuments({
    model: "test-embed-v1",
    characters: [
      { id: 1, name: "林夜", goal: "查清黑铁令来历", background: "寒门出身" },
    ],
    relations: [
      {
        id: 4,
        sourceName: "林夜",
        sourceType: "character",
        sourceId: 1,
        targetName: "顾沉舟",
        targetType: "character",
        targetId: 2,
        relationType: "observer",
        relationSummary: "因黑铁令互相试探",
        status: "互信不足",
        description: "近期因黑铁令线索被迫联手",
        notes: "关系不能突然完全和解",
      },
    ],
    hooks: [
      { id: 2, title: "黑铁令身份核验", expected_payoff: "第五章触发" },
    ],
    worldSettings: [
      { id: 3, title: "宗门制度", category: "规则", content: "外门弟子凭令牌登记入门" },
    ],
  });

  assert.equal(documents.length, 4);
  assert.deepEqual(
    documents.map((item) => item.chunkKey),
    ["character:1:summary", "hook:2:summary", "relation:4:summary", "world_setting:3:summary"],
  );
  assert.deepEqual(
    documents.map((item) => item.displayName),
    ["林夜", "黑铁令身份核验", "林夜 -> 顾沉舟", "宗门制度"],
  );
  assert.match(documents[0]?.text ?? "", /林夜/);
  assert.deepEqual(documents[2]?.relationEndpoints, [
    { entityType: "character", entityId: 1, displayName: "林夜" },
    { entityType: "character", entityId: 2, displayName: "顾沉舟" },
  ]);
  assert.deepEqual(documents[2]?.relationMetadata, {
    relationType: "observer",
    status: "互信不足",
    description: "近期因黑铁令线索被迫联手",
    appendNotes: "关系不能突然完全和解",
  });
  assert.match(documents[3]?.text ?? "", /宗门制度/);
});
