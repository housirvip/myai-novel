import assert from "node:assert/strict";
import test from "node:test";

import { buildIndexedEmbeddingDocuments, InMemoryEmbeddingStore } from "../../../src/domain/planning/embedding-store.js";

test("InMemoryEmbeddingStore replaces and filters documents by model and entity type", async () => {
  const store = new InMemoryEmbeddingStore();
  const documents = buildIndexedEmbeddingDocuments(
    [
      {
        entityType: "character",
        entityId: 1,
        chunkKey: "character:1:summary",
        model: "embed-v1",
        displayName: "林夜",
        text: "人物：林夜",
      },
      {
        entityType: "hook",
        entityId: 2,
        chunkKey: "hook:2:summary",
        model: "embed-v1",
        displayName: "黑铁令身份核验",
        text: "钩子：黑铁令身份核验",
      },
    ],
    [[1, 0], [0, 1]],
  );

  await store.replaceDocuments({ model: "embed-v1", entityType: "character", documents: [documents[0]! ] });
  await store.replaceDocuments({ model: "embed-v1", entityType: "hook", documents: [documents[1]! ] });

  const all = await store.listDocuments({ model: "embed-v1" });
  const characters = await store.listDocuments({ model: "embed-v1", entityType: "character" });

  assert.equal(all.length, 2);
  assert.equal(characters.length, 1);
  assert.equal(characters[0]?.displayName, "林夜");
});
