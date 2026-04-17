import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runInlineModule } from "../helpers/cli.js";

test("retrieval service skips placeholder chapters and returns richer entity context", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    recentChapters: Array<{ chapterNo: number; summary: string | null }>;
    character: { content: string };
    abilityMatchedCharacter: { content: string } | null;
    faction: { content: string };
    item: { content: string };
    relation: { content: string };
    hardConstraintHook: { content: string } | null;
    hardConstraintCharacter: { content: string } | null;
    hardConstraintItem: { content: string } | null;
    hardConstraintRelation: { content: string } | null;
    hardConstraintWorldSetting: { content: string } | null;
    riskReminders: string[];
    priorityBlockingCount: number;
    priorityDecisionCount: number;
    candidateCharacterSource: string | null;
    hardConstraintCharacterSelectedBy: string[];
    priorityBlockingAssignedBy: string[];
    recentChanges: Array<{ source: string; label: string; detail: string }>;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({",
      "    id: 1, title: '测试书', summary: null, target_chapter_count: 100, current_chapter_count: 2, status: 'writing', metadata: null, created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('chapters').values([",
      "    { id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: '第一章正式总结', word_count: 1000, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 2, title: '第二章', summary: null, word_count: 1200, status: 'drafted', current_plan_id: 1, current_draft_id: 1, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 3, book_id: 1, chapter_no: 3, title: '第三章占位', summary: null, word_count: null, status: 'todo', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 4, book_id: 1, chapter_no: 4, title: '第四章占位', summary: null, word_count: null, status: 'todo', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 5, book_id: 1, chapter_no: 5, title: '第五章', summary: null, word_count: null, status: 'todo', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "  ]).execute();",
      "  await db.insertInto('chapter_plans').values({",
      "    id: 1, book_id: 1, chapter_id: 2, chapter_no: 2, version_no: 1, status: 'active', author_intent: '第二章作者意图', intent_source: 'user_input', intent_keywords: '[\"黑铁令\"]', manual_entity_refs: null, retrieved_context: null, content: '第二章计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('chapter_drafts').values({",
      "    id: 1, book_id: 1, chapter_id: 2, chapter_no: 2, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '第二章草稿内容', summary: '第二章草稿总结', word_count: 1200, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('characters').values({",
      "    id: 1, book_id: 1, name: '林夜', alias: '夜哥', gender: '男', age: 16, personality: '冷静谨慎', background: '寒门出身', current_location: '青岳宗外门', status: 'alive', professions: '[\"弟子\"]', levels: '[\"炼气三层\"]', currencies: '[{\"type\":\"灵石\",\"amount\":12}]', abilities: '[\"感知增强\"]', goal: '查清黑铁令来历', append_notes: '最近得到黑铁令', keywords: '[\"林夜\",\"黑铁令\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('factions').values({",
      "    id: 1, book_id: 1, name: '青岳宗', category: '宗门', core_goal: '维持宗门秩序', description: '东境大宗门', leader_character_id: null, headquarter: '青岳山', status: 'active', append_notes: '外门局势紧张', keywords: '[\"青岳宗\",\"外门\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('items').values({",
      "    id: 1, book_id: 1, name: '黑铁令', category: '令牌', description: '可用于特殊身份核验', owner_type: 'character', owner_id: 1, rarity: 'unknown', status: 'active', append_notes: '会引起执事异常反应', keywords: '[\"黑铁令\",\"令牌\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('relations').values({",
      "    id: 1, book_id: 1, source_type: 'character', source_id: 1, target_type: 'faction', target_id: 1, relation_type: 'member', intensity: 60, status: 'active', description: '林夜已经进入青岳宗外门', append_notes: '关系刚建立', keywords: '[\"林夜\",\"青岳宗\",\"外门\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('story_hooks').values({",
      "    id: 1, book_id: 1, title: '黑铁令身份核验', hook_type: '伏笔', description: '执事会对黑铁令来源起疑', source_chapter_no: 2, target_chapter_no: 5, status: 'open', importance: 'high', append_notes: '第五章必须承接', keywords: '[\"黑铁令\",\"执事\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  await db.insertInto('world_settings').values({",
      "    id: 1, book_id: 1, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门', status: 'active', append_notes: null, keywords: '[\"宗门\",\"令牌\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 5,",
      "    keywords: ['林夜', '青岳宗', '黑铁令', '令牌'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  const abilityContext = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 5,",
      "    keywords: ['感知增强'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({",
      "    recentChapters: context.recentChapters,",
      "    character: context.characters[0],",
      "    abilityMatchedCharacter: abilityContext.characters[0] ?? null,",
      "    faction: context.factions[0],",
      "    item: context.items[0],",
      "    relation: context.relations[0],",
      "    hardConstraintHook: context.hardConstraints.hooks[0] ?? null,",
      "    hardConstraintCharacter: context.hardConstraints.characters[0] ?? null,",
      "    hardConstraintItem: context.hardConstraints.items[0] ?? null,",
      "    hardConstraintRelation: context.hardConstraints.relations[0] ?? null,",
      "    hardConstraintWorldSetting: context.hardConstraints.worldSettings[0] ?? null,",
      "    riskReminders: context.riskReminders,",
      "    priorityBlockingCount: context.priorityContext?.blockingConstraints.length ?? 0,",
      "    priorityDecisionCount: context.priorityContext?.decisionContext.length ?? 0,",
      "    candidateCharacterSource: context.retrievalObservability?.candidates.characters[0]?.source ?? null,",
      "    hardConstraintCharacterSelectedBy: context.retrievalObservability?.hardConstraints.characters[0]?.selectedBy ?? [],",
      "    priorityBlockingAssignedBy: context.retrievalObservability?.priorityContext.blockingConstraints[0]?.assignedBy ?? [],",
      "    recentChanges: context.recentChanges ?? [],",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.deepEqual(
    result.recentChapters.map((chapter) => chapter.chapterNo),
    [2, 1],
  );
  assert.equal(result.recentChapters[0]?.summary, "第二章草稿总结");
  assert.match(result.character.content, /background=寒门出身/);
  assert.match(result.character.content, /current_location=青岳宗外门/);
  assert.match(result.character.content, /personality=冷静谨慎/);
  assert.match(result.character.content, /currencies=/);
  assert.match(result.character.content, /abilities=/);
  assert.ok(result.abilityMatchedCharacter);
  assert.match(result.faction.content, /description=东境大宗门/);
  assert.match(result.item.content, /description=可用于特殊身份核验/);
  assert.match(result.item.content, /status=active/);
  assert.match(result.relation.content, /source=林夜/);
  assert.match(result.relation.content, /target=青岳宗/);

  assert.ok(result.hardConstraintHook);
  assert.match(result.hardConstraintHook.content, /target_chapter_no=5/);
  assert.ok(result.hardConstraintCharacter);
  assert.match(result.hardConstraintCharacter.content, /current_location=青岳宗外门/);
  assert.ok(result.hardConstraintItem);
  assert.match(result.hardConstraintItem.content, /owner_type=character/);
  assert.ok(result.hardConstraintRelation);
  assert.match(result.hardConstraintRelation.content, /relation_type=member/);
  assert.ok(result.hardConstraintWorldSetting);
  assert.match(result.hardConstraintWorldSetting.content, /category=规则/);

  assert.ok(result.riskReminders.some((item) => item.includes("接近回收节点的重要钩子")));
  assert.ok(result.riskReminders.some((item) => item.includes("人物当前位置连续性")));
  assert.ok(result.riskReminders.some((item) => item.includes("关键物品的持有者与状态连续性")));
  assert.ok(result.riskReminders.some((item) => item.includes("已激活的世界规则")));
  assert.ok(result.priorityBlockingCount >= 4);
  assert.ok(result.priorityDecisionCount >= 1);
  assert.equal(result.candidateCharacterSource, "rule");
  assert.ok(result.hardConstraintCharacterSelectedBy.length >= 1);
  assert.ok(result.priorityBlockingAssignedBy.length >= 1);
  assert.ok(result.recentChanges.length >= 3);
  assert.ok(result.recentChanges.some((item) => item.source === "risk_reminder"));
  assert.ok(result.recentChanges.some((item) => item.source === "chapter_summary"));
});

test("retrieval service keeps default rule-based behavior when reranker is pass-through", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-pipeline-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ sameCharacterOrder: boolean; sameRiskReminders: boolean }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { DirectPassThroughReranker } from './src/domain/planning/retrieval-pipeline.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: '黑铁令出场', word_count: 1000, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 1, book_id: 1, name: '林夜', alias: '夜哥', gender: '男', age: 18, personality: '冷静', background: '寒门', current_location: '青岳宗外门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '调查黑铁令', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, name: '顾沉舟', alias: null, gender: '男', age: 22, personality: '谨慎', background: '宗门弟子', current_location: '内门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '观察局势', append_notes: null, keywords: '[\"外门\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('items').values({ id: 1, book_id: 1, name: '黑铁令', category: '令牌', description: '身份凭证', owner_type: 'character', owner_id: 1, rarity: 'rare', status: 'active', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }).execute();",
      "  const baseService = new RetrievalQueryService(logger);",
      "  const pipelineService = new RetrievalQueryService(logger, { reranker: new DirectPassThroughReranker() });",
      "  const params = { bookId: 1, chapterNo: 2, keywords: ['黑铁令', '林夜'], manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const baseContext = await baseService.retrievePlanContext(params);",
      "  const pipelineContext = await pipelineService.retrievePlanContext(params);",
      "  console.log(JSON.stringify({",
      "    sameCharacterOrder: JSON.stringify(baseContext.characters.map((item) => item.id)) === JSON.stringify(pipelineContext.characters.map((item) => item.id)),",
      "    sameRiskReminders: JSON.stringify(baseContext.riskReminders) === JSON.stringify(pipelineContext.riskReminders),",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.sameCharacterOrder, true);
  assert.equal(result.sameRiskReminders, true);
});

test("retrieval service can apply heuristic reranker to promote continuity-heavy candidates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-heuristic-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ topCharacterName: string | null; topHookTitle: string | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { HeuristicReranker } from './src/domain/planning/retrieval-reranker-heuristic.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 4, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 4, title: '第四章', summary: '黑铁令异动', word_count: 1000, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 1, book_id: 1, name: '顾沉舟', alias: null, gender: '男', age: 22, personality: '谨慎', background: '宗门弟子', current_location: '内门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '观望局势', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, name: '林夜', alias: null, gender: '男', age: 18, personality: '冷静', background: '寒门', current_location: '青岳宗外门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '调查黑铁令', append_notes: null, keywords: '[\"林夜\",\"黑铁令\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('story_hooks').values([",
      "    { id: 1, book_id: 1, title: '远期伏笔', hook_type: '伏笔', description: '后续再触发', source_chapter_no: 2, target_chapter_no: 9, status: 'open', importance: 'high', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, title: '临近伏笔', hook_type: '伏笔', description: '本章触发', source_chapter_no: 4, target_chapter_no: 5, status: 'open', importance: 'high', append_notes: '即将兑现', keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  const service = new RetrievalQueryService(logger, { reranker: new HeuristicReranker() });",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 5,",
      "    keywords: ['黑铁令', '林夜'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({",
      "    topCharacterName: context.characters[0]?.name ?? null,",
      "    topHookTitle: context.hooks[0]?.title ?? null,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.topCharacterName, "林夜");
  assert.equal(result.topHookTitle, "临近伏笔");
});

test("retrieval service can enable embedding candidate provider via config with injected searcher", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-embedding-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_ENABLED: "true",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ worldSettingCount: number; topWorldSettingReason: string | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  const service = new RetrievalQueryService(logger, {",
      "    embeddingSearcher: {",
      "      async search() {",
      "        return [",
      "          { entityType: 'world_setting', entityId: 9, chunkKey: 'world:9:summary', semanticScore: 0.88, text: '设定：宗门制度\\n规则摘要：外门弟子凭令牌登记入门' },",
      "        ];",
      "      },",
      "    },",
      "  });",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 2,",
      "    keywords: ['令牌', '入门'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({",
      "    worldSettingCount: context.worldSettings.length,",
      "    topWorldSettingReason: context.worldSettings[0]?.reason ?? null,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.worldSettingCount, 1);
  assert.equal(result.topWorldSettingReason, "embedding_match");
});

test("retrieval service honors hybrid embedding mode with injected searcher", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-hybrid-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_ENABLED: "true",
    PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: "hybrid",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ worldSettingCount: number; topReason: string | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { DeterministicHashEmbeddingProvider } from './src/domain/planning/embedding-provider.ts';",
      "import { HybridEmbeddingSearcher } from './src/domain/planning/embedding-searcher-hybrid.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  const searcher = new HybridEmbeddingSearcher(new DeterministicHashEmbeddingProvider());",
      "  await searcher.index([",
      `    { entityType: 'world_setting', entityId: 9, chunkKey: 'world_setting:9:summary', model: 'test-embed-v1', text: ${JSON.stringify("设定：宗门制度\n规则摘要：外门弟子凭令牌登记入门")} },`,
      "  ]);",
      "  const service = new RetrievalQueryService(logger, { embeddingSearcher: searcher, embeddingSearchMode: 'hybrid' });",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 2,",
      "    keywords: ['规则', '令牌', '登记'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({ worldSettingCount: context.worldSettings.length, topReason: context.worldSettings[0]?.reason ?? null }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.worldSettingCount, 1);
  assert.equal(result.topReason, "embedding_match");
});

test("configured planning retrieval service wires embedding searcher for normal workflow use across entity groups", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-factory-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_ENABLED: "true",
    PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: "hybrid",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    baseWorldSettingCount: number;
    wiredWorldSettingReason: string | null;
    baseFactionCount: number;
    wiredFactionReason: string | null;
    baseItemCount: number;
    wiredItemReason: string | null;
    baseRelationCount: number;
    wiredRelationReason: string | null;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { createPlanningRetrievalService } from './src/domain/planning/retrieval-service-factory.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('factions').values({ id: 1, book_id: 1, name: '青岳宗', category: '宗门', core_goal: '维持外门登记秩序', description: '负责外门令牌登记', leader_character_id: null, headquarter: null, status: 'active', append_notes: '不能突然放松登记制度', keywords: '[\"宗门\",\"登记\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values([{ id: 1, book_id: 1, name: '林夜', alias: null, gender: '男', age: 18, personality: null, background: null, current_location: '外门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }, { id: 2, book_id: 1, name: '顾沉舟', alias: null, gender: '男', age: 22, personality: null, background: null, current_location: '内门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: '[\"核验\"]', created_at: now, updated_at: now }]).execute();",
      "  await db.insertInto('items').values({ id: 1, book_id: 1, name: '黑铁令', category: '令牌', description: '登记凭证', owner_type: 'character', owner_id: 1, rarity: 'rare', status: 'active', append_notes: '不可无交代易主', keywords: '[\"令牌\",\"登记\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('relations').values({ id: 1, book_id: 1, source_type: 'character', source_id: 1, target_type: 'character', target_id: 2, relation_type: 'observer', intensity: 60, status: '互相试探', description: '因黑铁令线索产生试探', append_notes: '关系不能突然缓和', keywords: '[\"黑铁令\",\"试探\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('world_settings').values({ id: 1, book_id: 1, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门', status: 'active', append_notes: '违反后会被逐出山门', keywords: '[\"宗门\",\"令牌\"]', created_at: now, updated_at: now }).execute();",
      "  const baseService = new RetrievalQueryService(logger);",
      "  const wiredService = await createPlanningRetrievalService(logger, db, { bookId: 1 });",
      "  const worldSettingParams = { bookId: 1, chapterNo: 2, keywords: ['执行条件'], manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const factionParams = { bookId: 1, chapterNo: 2, keywords: ['秩序执行'], manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const itemParams = { bookId: 1, chapterNo: 2, keywords: ['身份凭证'], manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const relationParams = { bookId: 1, chapterNo: 2, keywords: ['互相试探'], manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const baseWorldContext = await baseService.retrievePlanContext(worldSettingParams);",
      "  const wiredWorldContext = await wiredService.retrievePlanContext(worldSettingParams);",
      "  const baseFactionContext = await baseService.retrievePlanContext(factionParams);",
      "  const wiredFactionContext = await wiredService.retrievePlanContext(factionParams);",
      "  const baseItemContext = await baseService.retrievePlanContext(itemParams);",
      "  const wiredItemContext = await wiredService.retrievePlanContext(itemParams);",
      "  const baseRelationContext = await baseService.retrievePlanContext(relationParams);",
      "  const wiredRelationContext = await wiredService.retrievePlanContext(relationParams);",
      "  console.log(JSON.stringify({",
      "    baseWorldSettingCount: baseWorldContext.worldSettings.length,",
      "    wiredWorldSettingReason: wiredWorldContext.worldSettings[0]?.reason ?? null,",
      "    baseFactionCount: baseFactionContext.factions.length,",
      "    wiredFactionReason: wiredFactionContext.factions[0]?.reason ?? null,",
      "    baseItemCount: baseItemContext.items.length,",
      "    wiredItemReason: wiredItemContext.items[0]?.reason ?? null,",
      "    baseRelationCount: baseRelationContext.relations.length,",
      "    wiredRelationReason: wiredRelationContext.relations[0]?.reason ?? null,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.baseWorldSettingCount, 0);
  assert.equal(result.wiredWorldSettingReason, "embedding_match");
  assert.equal(result.baseFactionCount, 0);
  assert.equal(result.wiredFactionReason, "embedding_match");
  assert.equal(result.baseItemCount, 0);
  assert.equal(result.wiredItemReason, "embedding_match");
  assert.equal(result.baseRelationCount, 0);
  assert.equal(result.wiredRelationReason, "embedding_match");
});

test("retrieval ranking prefers stronger weighted hits and keeps continuity entities in hard constraints", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-weighted-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    topCharacterName: string | null;
    secondCharacterName: string | null;
    topFactionName: string | null;
    secondFactionName: string | null;
    hardConstraintCharacterIds: number[];
    hardConstraintItemIds: number[];
    hardConstraintWorldSettingIds: number[];
    riskReminders: string[];
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 50, current_chapter_count: 4, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values([",
      "    { id: 1, book_id: 1, chapter_no: 4, title: '第四章', summary: '黑铁令异动', word_count: 1200, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 5, title: '第五章', summary: null, word_count: null, status: 'todo', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 1, book_id: 1, name: '林夜', alias: '黑铁令主', gender: '男', age: 18, personality: '冷静', background: '寒门', current_location: '青岳宗外门', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '调查黑铁令', append_notes: null, keywords: '[\"主角\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, name: '顾沉舟', alias: '旁观者', gender: '男', age: 22, personality: '谨慎', background: '宗门弟子', current_location: '演武场', status: 'alive', professions: null, levels: null, currencies: null, abilities: '[\"黑铁令鉴定\"]', goal: '观望局势', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('factions').values([",
      "    { id: 1, book_id: 1, name: '黑铁盟', category: '组织', core_goal: '争夺黑铁令', description: '围绕黑铁令活动', leader_character_id: null, headquarter: null, status: 'active', append_notes: null, keywords: '[\"外围势力\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, name: '青岳宗', category: '宗门', core_goal: '维持秩序', description: '常规宗门势力', leader_character_id: null, headquarter: null, status: 'active', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('items').values({ id: 1, book_id: 1, name: '黑铁令', category: '令牌', description: '身份凭证', owner_type: 'character', owner_id: 1, rarity: 'rare', status: 'active', append_notes: '仍由林夜持有', keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('world_settings').values({ id: 1, book_id: 1, title: '黑铁令规则', category: '规则', content: '黑铁令必须登记后方可使用', status: 'active', append_notes: null, keywords: '[\"黑铁令\"]', created_at: now, updated_at: now }).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 5,",
      "    keywords: ['黑铁令', '黑铁盟', '林夜'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({",
      "    topCharacterName: context.characters[0]?.name ?? null,",
      "    secondCharacterName: context.characters[1]?.name ?? null,",
      "    topFactionName: context.factions[0]?.name ?? null,",
      "    secondFactionName: context.factions[1]?.name ?? null,",
      "    hardConstraintCharacterIds: context.hardConstraints.characters.map((item) => item.id),",
      "    hardConstraintItemIds: context.hardConstraints.items.map((item) => item.id),",
      "    hardConstraintWorldSettingIds: context.hardConstraints.worldSettings.map((item) => item.id),",
      "    riskReminders: context.riskReminders,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.topCharacterName, "林夜");
  assert.equal(result.secondCharacterName, "顾沉舟");
  assert.equal(result.topFactionName, "黑铁盟");
  assert.equal(result.secondFactionName, "青岳宗");
  assert.equal(result.hardConstraintCharacterIds[0], 1);
  assert.ok(result.hardConstraintCharacterIds.includes(1));
  assert.deepEqual(result.hardConstraintItemIds, [1]);
  assert.deepEqual(result.hardConstraintWorldSettingIds, [1]);
  assert.ok(result.riskReminders.some((item) => item.includes("人物当前位置连续性")));
  assert.ok(result.riskReminders.some((item) => item.includes("关键物品的持有者与状态连续性")));
  assert.ok(result.riskReminders.some((item) => item.includes("已激活的世界规则")));
});
