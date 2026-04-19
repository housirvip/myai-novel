import assert from "node:assert/strict";
import test from "node:test";

import { migrateToLatest } from "../../../src/core/db/migrations/initial.js";
import { buildIndexedEmbeddingDocuments, DbRetrievalDocumentEmbeddingStore, InMemoryEmbeddingStore } from "../../../src/domain/planning/embedding-store.js";
import { createInMemoryDb, createNoopLogger } from "../../helpers/sqlite.js";

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

test("DbRetrievalDocumentEmbeddingStore persists and reloads embedding documents by model and entity type", async () => {
  const db = createInMemoryDb();
  const logger = createNoopLogger() as never;

  try {
    await migrateToLatest(db, logger);
    await db.insertInto("books").values({
      id: 1,
      title: "测试书",
      summary: null,
      target_chapter_count: 10,
      current_chapter_count: 1,
      status: "writing",
      metadata: null,
      created_at: "2026-04-10T15:00:00.000Z",
      updated_at: "2026-04-10T15:00:00.000Z",
    }).execute();

    const store = new DbRetrievalDocumentEmbeddingStore(db, 1);
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
          entityType: "relation",
          entityId: 2,
          chunkKey: "relation:2:summary",
          model: "embed-v1",
          displayName: "林夜 -> 顾沉舟",
          text: "关系：互相试探",
          relationEndpoints: [
            { entityType: "character", entityId: 1, displayName: "林夜" },
            { entityType: "character", entityId: 2, displayName: "顾沉舟" },
          ],
          relationMetadata: { relationType: "observer", status: "active" },
        },
      ],
      [[1, 0], [0, 1]],
    );

    await store.replaceDocuments({ model: "embed-v1", entityType: "character", documents: [documents[0]!] });
    await store.replaceDocuments({ model: "embed-v1", entityType: "relation", documents: [documents[1]!] });

    const all = await store.listDocuments({ model: "embed-v1" });
    const relations = await store.listDocuments({ model: "embed-v1", entityType: "relation" });

    assert.equal(all.length, 2);
    assert.equal(relations.length, 1);
    assert.equal(relations[0]?.relationMetadata?.relationType, "observer");
    assert.equal(relations[0]?.relationEndpoints?.length, 2);

    await store.clearDocuments({ model: "embed-v1", entityType: "character" });
    assert.equal((await store.listDocuments({ model: "embed-v1", entityType: "character" })).length, 0);
    assert.equal((await store.listDocuments({ model: "embed-v1", entityType: "relation" })).length, 1);
  } finally {
    await db.destroy();
  }
});
