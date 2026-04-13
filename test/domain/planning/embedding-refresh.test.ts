import assert from "node:assert/strict";
import test from "node:test";

import { DeterministicHashEmbeddingProvider } from "../../../src/domain/planning/embedding-provider.js";
import { EmbeddingRefreshService } from "../../../src/domain/planning/embedding-refresh.js";
import { InMemoryEmbeddingStore } from "../../../src/domain/planning/embedding-store.js";

test("EmbeddingRefreshService builds and stores indexed documents by entity type", async () => {
  const store = new InMemoryEmbeddingStore();
  const service = new EmbeddingRefreshService(new DeterministicHashEmbeddingProvider(), store);

  await service.refresh({
    model: "embed-v1",
    characters: [{ id: 1, name: "林夜", goal: "查清黑铁令来历" }],
    hooks: [{ id: 2, title: "黑铁令身份核验", expected_payoff: "第五章触发" }],
    worldSettings: [{ id: 3, title: "宗门制度", category: "规则", content: "外门弟子凭令牌登记入门" }],
  });

  const characters = await store.listDocuments({ model: "embed-v1", entityType: "character" });
  const hooks = await store.listDocuments({ model: "embed-v1", entityType: "hook" });
  const worldSettings = await store.listDocuments({ model: "embed-v1", entityType: "world_setting" });

  assert.equal(characters.length, 1);
  assert.equal(hooks.length, 1);
  assert.equal(worldSettings.length, 1);
  assert.equal(worldSettings[0]?.displayName, "宗门制度");
  assert.ok((worldSettings[0]?.vector.length ?? 0) > 0);
});

test("EmbeddingRefreshService can refresh a single entity type without touching others", async () => {
  const store = new InMemoryEmbeddingStore();
  const service = new EmbeddingRefreshService(new DeterministicHashEmbeddingProvider(), store);

  await service.refresh({
    model: "embed-v1",
    characters: [{ id: 1, name: "林夜", goal: "查清黑铁令来历" }],
    hooks: [{ id: 2, title: "黑铁令身份核验", expected_payoff: "第五章触发" }],
  });

  await service.refreshEntityType({
    model: "embed-v1",
    entityType: "character",
    characters: [{ id: 3, name: "顾沉舟", goal: "暗中观察黑铁令持有者" }],
  });

  const characters = await store.listDocuments({ model: "embed-v1", entityType: "character" });
  const hooks = await store.listDocuments({ model: "embed-v1", entityType: "hook" });

  assert.equal(characters.length, 1);
  assert.equal(characters[0]?.displayName, "顾沉舟");
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0]?.displayName, "黑铁令身份核验");
});

test("EmbeddingRefreshService can clear all documents for one model", async () => {
  const store = new InMemoryEmbeddingStore();
  const service = new EmbeddingRefreshService(new DeterministicHashEmbeddingProvider(), store);

  await service.refresh({
    model: "embed-v1",
    characters: [{ id: 1, name: "林夜", goal: "查清黑铁令来历" }],
  });
  await service.refresh({
    model: "embed-v2",
    hooks: [{ id: 2, title: "黑铁令身份核验", expected_payoff: "第五章触发" }],
  });

  await service.clearModel("embed-v1");

  const v1Docs = await store.listDocuments({ model: "embed-v1" });
  const v2Docs = await store.listDocuments({ model: "embed-v2" });

  assert.equal(v1Docs.length, 0);
  assert.equal(v2Docs.length, 1);
});
