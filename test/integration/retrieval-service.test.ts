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
    riskReminders: Array<{ text: string }>;
    priorityBlockingCount: number;
    priorityDecisionCount: number;
    candidateCharacterSource: string | null;
    hardConstraintCharacterSelectedBy: string[];
    priorityBlockingAssignedBy: string[];
    recentChanges: Array<{ source: string; label: string; detail: string }>;
    persistedFactReminderCount: number;
    persistedEventChangeCount: number;
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
       "  await db.insertInto('retrieval_facts').values({ id: 1, book_id: 1, chapter_no: 2, entity_type: null, entity_id: null, event_id: null, fact_type: 'chapter_summary', fact_key: 'chapter:1:2:summary', fact_text: '黑铁令旧案尚未收束。', payload_json: null, importance: 90, risk_level: 88, effective_from_chapter_no: 2, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now }).execute();",
       "  await db.insertInto('story_events').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, event_type: 'investigation', title: '黑铁令旧案回收前兆', summary: '执事档案库再次提起黑铁令旧案。', participant_entity_refs: null, location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '仍需确认黑铁副令来源。', hook_refs: null, status: 'active', created_at: now, updated_at: now }).execute();",
       "  const service = new RetrievalQueryService(logger);",
       "  const context = await service.retrievePlanContext({",
       "    bookId: 1,",
       "    chapterNo: 5,",
       "    keywords: ['林夜', '青岳宗', '黑铁令', '令牌'],",
       "    queryText: '林夜 青岳宗 黑铁令 令牌',",
       "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
       "  });",
       "  const abilityContext = await service.retrievePlanContext({",
       "    bookId: 1,",
       "    chapterNo: 5,",
       "    keywords: ['感知增强'],",
       "    queryText: '感知增强',",
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
       "    persistedFactReminderCount: context.riskReminders.filter((item) => item.text.includes('黑铁令旧案尚未收束')).length,",
       "    persistedEventChangeCount: context.recentChanges.filter((item) => item.source === 'story_event').length,",
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

  assert.ok(result.riskReminders.some((item) => item.text.includes("接近回收节点的重要钩子")));
  assert.ok(result.riskReminders.some((item) => item.text.includes("人物当前位置连续性")));
  assert.ok(result.riskReminders.some((item) => item.text.includes("关键物品的持有者与状态连续性")));
  assert.ok(result.riskReminders.some((item) => item.text.includes("已激活的世界规则")));
  assert.ok(result.priorityBlockingCount >= 4);
  assert.ok(result.priorityDecisionCount >= 1);
  assert.equal(result.candidateCharacterSource, "rule");
  assert.ok(result.hardConstraintCharacterSelectedBy.length >= 1);
  assert.ok(result.priorityBlockingAssignedBy.length >= 1);
  assert.ok(result.recentChanges.length >= 3);
  assert.ok(result.recentChanges.some((item) => item.source === "risk_reminder"));
  assert.ok(result.recentChanges.some((item) => item.source === "retrieval_fact"));
  assert.ok(result.recentChanges.some((item) => item.source === "story_event"));
  assert.ok(result.recentChanges.some((item) => item.source === "chapter_summary"));
  assert.equal(result.persistedFactReminderCount, 1);
  assert.ok(result.persistedEventChangeCount >= 1);
});

test("retrieval service defaults to heuristic reranker behavior", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-pipeline-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ sameCharacterOrder: boolean; sameRiskReminders: boolean }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { HeuristicReranker } from './src/domain/planning/retrieval-reranker-heuristic.ts';",
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
      "  const pipelineService = new RetrievalQueryService(logger, { reranker: new HeuristicReranker() });",
       "  const params = { bookId: 1, chapterNo: 2, keywords: ['黑铁令', '林夜'], queryText: '黑铁令 林夜', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
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

test("retrieval service does not treat author intent as recent chapter factual summary", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-recent-summary-boundary-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ recentChapterNos: number[]; recentSummaries: Array<string | null> }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 20, current_chapter_count: 3, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values([",
      "    { id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: '第一章正式总结', word_count: 1200, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 2, title: '第二章', summary: null, word_count: 1200, status: 'planned', current_plan_id: 1, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 2, chapter_no: 2, version_no: 1, status: 'active', author_intent: '第二章作者意图，不应被当作既成事实摘要', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: null, retrieved_context: null, content: '第二章计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 3, keywords: ['作者意图'], queryText: '作者意图', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ recentChapterNos: context.recentChapters.map((item) => item.chapterNo), recentSummaries: context.recentChapters.map((item) => item.summary) }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.deepEqual(result.recentChapterNos, [1]);
  assert.deepEqual(result.recentSummaries, ["第一章正式总结"]);
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
       "    queryText: '黑铁令 林夜',",
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

test("retrieval service selects persisted facts/events with query-aware preference, not raw risk alone", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-sidecar-query-aware-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    blockingNames: string[];
    recentChangeDetails: string[];
    persistedFactTrace: { keywordMatched: boolean; structuralManualMatch: boolean; structuralBoost: number } | null;
    persistedEventTrace: { keywordMatched: boolean; structuralManualMatch: boolean; structuralBoost: number } | null;
    droppedFactReason: string | null;
    factSurfacedIn: string[];
    eventSurfacedIn: string[];
    reminderSourceRefs: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 100, current_chapter_count: 20, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 19, title: '第十九章', summary: '上一章总结', word_count: 1800, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values({ id: 1, book_id: 1, name: '林夜', alias: null, gender: '男', age: 16, personality: '冷静谨慎', background: '寒门出身', current_location: '青岳宗外门', status: 'alive', professions: '[\"弟子\"]', levels: null, currencies: null, abilities: null, goal: '查清黑铁令旧案', append_notes: null, keywords: '[\"黑铁令\",\"旧案\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('retrieval_facts').values([",
      "    { id: 1, book_id: 1, chapter_no: 7, entity_type: null, entity_id: null, event_id: null, fact_type: 'chapter_summary', fact_key: 'chapter:1:7:summary', fact_text: '灵田税改风波仍未收束。', payload_json: null, importance: 95, risk_level: 99, effective_from_chapter_no: 7, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 12, entity_type: 'character', entity_id: 1, event_id: null, fact_type: 'chapter_summary', fact_key: 'chapter:1:12:summary', fact_text: '黑铁令旧案尚未收束，林夜仍在追查。', payload_json: null, importance: 80, risk_level: 82, effective_from_chapter_no: 12, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('story_events').values([",
      "    { id: 1, book_id: 1, chapter_id: 1, chapter_no: 8, event_type: 'tax', title: '灵田税改', summary: '灵田税改引发争议。', participant_entity_refs: null, location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '税改后续仍有争议。', hook_refs: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_id: 1, chapter_no: 13, event_type: 'investigation', title: '黑铁令旧案回收前兆', summary: '执事档案库再次提起黑铁令旧案。', participant_entity_refs: JSON.stringify([{ entityType: 'character', entityId: 1 }]), location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '仍需确认黑铁副令来源。', hook_refs: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 20, keywords: ['林夜', '黑铁令', '旧案'], queryText: '林夜 黑铁令 旧案', manualRefs: { characterIds: [1], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ blockingNames: (context.priorityContext?.blockingConstraints ?? []).map((item) => item.displayName), recentChangeDetails: (context.recentChanges ?? []).map((item) => item.detail), persistedFactTrace: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 2)?.trace ?? null, persistedEventTrace: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 2)?.trace ?? null, droppedFactReason: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 1)?.droppedReason ?? null, factSurfacedIn: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 2)?.surfacedIn ?? [], eventSurfacedIn: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 2)?.surfacedIn ?? [], reminderSourceRefs: context.recentChanges.find((item) => item.source === 'risk_reminder' && item.detail.includes('黑铁令旧案尚未收束'))?.sourceRefs?.length ?? 0 }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.ok(result.blockingNames.includes("第12章事实"));
  assert.ok(result.blockingNames.includes("第13章事件"));
  assert.ok(!result.blockingNames.includes("第7章事实"));
  assert.ok(result.recentChangeDetails.some((item) => item.includes("黑铁令旧案尚未收束")));
  assert.equal(result.persistedFactTrace?.keywordMatched, true);
  assert.equal(result.persistedFactTrace?.structuralManualMatch, true);
  assert.ok((result.persistedFactTrace?.structuralBoost ?? 0) > 0);
  assert.equal(result.persistedEventTrace?.keywordMatched, true);
  assert.equal(result.droppedFactReason, "no_match");
  assert.ok(result.factSurfacedIn.includes("blockingConstraints"));
  assert.ok(result.factSurfacedIn.includes("recentChanges"));
  assert.ok(result.factSurfacedIn.includes("riskReminders"));
  assert.ok(result.eventSurfacedIn.includes("blockingConstraints"));
  assert.ok(result.eventSurfacedIn.includes("recentChanges"));
  assert.ok(result.eventSurfacedIn.includes("riskReminders"));
  assert.ok(result.reminderSourceRefs >= 1);
});

test("retrieval service preserves older high-risk facts and unresolved events via long-tail reserve", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-sidecar-long-tail-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT: "1",
    PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT: "1",
    PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE: "1",
    PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE: "1",
    PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP: "8",
    PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK: "80",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    selectedFactIds: number[];
    selectedEventIds: number[];
    oldFactDroppedReason: string | null;
    oldEventDroppedReason: string | null;
    oldFactRecencyScore: number;
    recentFactRecencyScore: number;
    oldEventRecencyScore: number;
    recentEventRecencyScore: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 200, current_chapter_count: 30, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('retrieval_facts').values([",
      "    { id: 1, book_id: 1, chapter_no: 29, entity_type: 'character', entity_id: 1, event_id: null, fact_type: 'character_update', fact_key: 'fact:1', fact_text: '黑铁令旧案出现新线索，林夜继续追查。', payload_json: null, importance: 100, risk_level: 20, effective_from_chapter_no: 29, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 10, entity_type: 'character', entity_id: 1, event_id: null, fact_type: 'character_update', fact_key: 'fact:2', fact_text: '黑铁令旧案主谋未明，仍需长期承接。', payload_json: null, importance: 60, risk_level: 96, effective_from_chapter_no: 10, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('story_events').values([",
      "    { id: 1, book_id: 1, chapter_id: null, chapter_no: 28, event_type: 'investigation', title: '近期旧案推进', summary: '黑铁令旧案近期出现推进。', participant_entity_refs: null, location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '林夜马上要核对最新线索。', hook_refs: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_id: null, chapter_no: 11, event_type: 'investigation', title: '早期旧案悬而未决', summary: '黑铁令旧案在更早章节埋下疑点。', participant_entity_refs: null, location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '真正主谋仍未现身。', hook_refs: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 30, keywords: ['黑铁令', '旧案', '林夜'], queryText: '黑铁令 旧案 林夜', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({",
      "    selectedFactIds: context.retrievalObservability?.persistedSidecarSelection.facts.filter((item) => item.selected).map((item) => item.id) ?? [],",
      "    selectedEventIds: context.retrievalObservability?.persistedSidecarSelection.events.filter((item) => item.selected).map((item) => item.id) ?? [],",
      "    oldFactDroppedReason: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 2)?.droppedReason ?? null,",
      "    oldEventDroppedReason: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 2)?.droppedReason ?? null,",
      "    oldFactRecencyScore: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 2)?.trace.recencyScore ?? -1,",
      "    recentFactRecencyScore: context.retrievalObservability?.persistedSidecarSelection.facts.find((item) => item.id === 1)?.trace.recencyScore ?? -1,",
      "    oldEventRecencyScore: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 2)?.trace.recencyScore ?? -1,",
      "    recentEventRecencyScore: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 1)?.trace.recencyScore ?? -1,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.deepEqual(result.selectedFactIds, [1, 2]);
  assert.deepEqual(result.selectedEventIds, [1, 2]);
  assert.equal(result.oldFactDroppedReason, null);
  assert.equal(result.oldEventDroppedReason, null);
  assert.ok(result.oldFactRecencyScore < result.recentFactRecencyScore);
  assert.ok(result.oldEventRecencyScore < result.recentEventRecencyScore);
});

test("retrieval service can enable embedding candidate provider via config with injected searcher", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-embedding-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
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
       "    queryText: '令牌 入门',",
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

test("retrieval service promotes story events via structured manual refs even when text is weak", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-sidecar-typed-match-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ blockingNames: string[]; recentChangeLabels: string[]; persistedEventTrace: { keywordMatched: boolean; structuralManualMatch: boolean; structuralBoost: number } | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 50, current_chapter_count: 20, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('story_events').values([",
      "    { id: 1, book_id: 1, chapter_id: null, chapter_no: 12, event_type: 'investigation', title: '模糊事件', summary: '局势出现波动。', participant_entity_refs: JSON.stringify([{ entityType: 'character', entityId: 9 }]), location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: null, hook_refs: JSON.stringify([99]), status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_id: null, chapter_no: 13, event_type: 'investigation', title: '结构化命中事件', summary: '局势出现波动。', participant_entity_refs: JSON.stringify([{ entityType: 'character', entityId: 1 }]), location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '仍需继续观察。', hook_refs: JSON.stringify([5]), status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 20, keywords: ['局势'], queryText: '局势', manualRefs: { characterIds: [1], factionIds: [], itemIds: [], hookIds: [5], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ blockingNames: (context.priorityContext?.blockingConstraints ?? []).map((item) => item.displayName), recentChangeLabels: (context.recentChanges ?? []).map((item) => item.label), persistedEventTrace: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 2)?.trace ?? null }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.ok(result.blockingNames.includes("第13章事件"));
  assert.ok(!result.blockingNames.includes("第12章事件"));
  assert.ok(result.recentChangeLabels.includes("第13章事件"));
  assert.equal(result.persistedEventTrace?.keywordMatched, true);
  assert.equal(result.persistedEventTrace?.structuralManualMatch, true);
  assert.ok((result.persistedEventTrace?.structuralBoost ?? 0) > 0);
});

test("retrieval service matches legacy grouped participant refs for story events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-sidecar-grouped-participants-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ blockingNames: string[]; persistedEventTrace: { keywordMatched: boolean; structuralManualMatch: boolean; structuralBoost: number } | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 50, current_chapter_count: 20, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('story_events').values({ id: 1, book_id: 1, chapter_id: null, chapter_no: 9, event_type: 'investigation', title: '旧格式事件', summary: '记录一条较弱的历史波动。', participant_entity_refs: JSON.stringify({ characters: [1], factions: [], items: [], hooks: [5], worldSettings: [] }), location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '仍需追查。', hook_refs: JSON.stringify([5]), status: 'active', created_at: now, updated_at: now }).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 20, keywords: ['无关词'], queryText: '无关词', manualRefs: { characterIds: [1], factionIds: [], itemIds: [], hookIds: [5], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ blockingNames: (context.priorityContext?.blockingConstraints ?? []).map((item) => item.displayName), persistedEventTrace: context.retrievalObservability?.persistedSidecarSelection.events.find((item) => item.id === 1)?.trace ?? null }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.ok(result.blockingNames.includes("第9章事件"));
  assert.equal(result.persistedEventTrace?.keywordMatched, false);
  assert.equal(result.persistedEventTrace?.structuralManualMatch, true);
  assert.ok((result.persistedEventTrace?.structuralBoost ?? 0) > 0);
});

test("retrieval observability exposes considered-vs-selected persisted sidecar counts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-sidecar-funnel-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    factsConsidered: number;
    factsSelected: number;
    factsDropped: number;
    eventsConsidered: number;
    eventsSelected: number;
    eventsDropped: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 50, current_chapter_count: 20, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('retrieval_facts').values([",
      "    { id: 1, book_id: 1, chapter_no: 7, entity_type: null, entity_id: null, event_id: null, fact_type: 'chapter_summary', fact_key: 'chapter:1:7:summary', fact_text: '灵田税改风波仍未收束。', payload_json: null, importance: 95, risk_level: 99, effective_from_chapter_no: 7, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 12, entity_type: 'character', entity_id: 1, event_id: null, fact_type: 'chapter_summary', fact_key: 'chapter:1:12:summary', fact_text: '黑铁令旧案尚未收束。', payload_json: null, importance: 80, risk_level: 82, effective_from_chapter_no: 12, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('story_events').values([",
      "    { id: 1, book_id: 1, chapter_id: null, chapter_no: 8, event_type: 'tax', title: '灵田税改', summary: '灵田税改引发争议。', participant_entity_refs: null, location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '税改后续仍有争议。', hook_refs: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_id: null, chapter_no: 13, event_type: 'investigation', title: '黑铁令旧案回收前兆', summary: '执事档案库再次提起黑铁令旧案。', participant_entity_refs: JSON.stringify([{ entityType: 'character', entityId: 1 }]), location_label: null, trigger_text: null, outcome_text: null, unresolved_impact: '仍需确认黑铁副令来源。', hook_refs: null, status: 'active', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 20, keywords: ['林夜', '黑铁令', '旧案'], queryText: '林夜 黑铁令 旧案', manualRefs: { characterIds: [1], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ factsConsidered: context.retrievalObservability?.persistedSidecarSelection.facts.length ?? 0, factsSelected: context.retrievalObservability?.persistedSidecarSelection.facts.filter((item) => item.selected).length ?? 0, factsDropped: context.retrievalObservability?.persistedSidecarSelection.facts.filter((item) => !item.selected).length ?? 0, eventsConsidered: context.retrievalObservability?.persistedSidecarSelection.events.length ?? 0, eventsSelected: context.retrievalObservability?.persistedSidecarSelection.events.filter((item) => item.selected).length ?? 0, eventsDropped: context.retrievalObservability?.persistedSidecarSelection.events.filter((item) => !item.selected).length ?? 0 }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.factsConsidered, 2);
  assert.equal(result.factsSelected, 1);
  assert.equal(result.factsDropped, 1);
  assert.equal(result.eventsConsidered, 2);
  assert.equal(result.eventsSelected, 1);
  assert.equal(result.eventsDropped, 1);
});

test("retrieval service honors hybrid embedding mode with injected searcher", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-hybrid-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
    PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: "hybrid",
    PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE: "0.1",
    PLANNING_RETRIEVAL_EMBEDDING_ONLY_MIN_SCORE: "0.1",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ worldSettingCount: number; topReason: string | null }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  const service = new RetrievalQueryService(logger, { embeddingSearchMode: 'hybrid', embeddingSearcher: { async search() { return [{ entityType: 'world_setting', entityId: 9, chunkKey: 'world_setting:9:summary', semanticScore: 0.88, displayName: '宗门制度', text: '设定：宗门制度\\n规则摘要：外门弟子凭令牌登记入门' }]; } } });",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 2,",
      "    keywords: ['规则', '令牌', '登记'],",
      "    queryText: '规则 令牌 登记',",
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
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
    PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: "hybrid",
    PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE: "0.1",
    PLANNING_RETRIEVAL_EMBEDDING_ONLY_MIN_SCORE: "0.1",
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
    persistedEmbeddingDocCount: number;
    persistedEmbeddingModel: string | null;
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
      "  const worldSettingParams = { bookId: 1, chapterNo: 2, keywords: ['执行条件'], queryText: '执行条件 宗门制度', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const factionParams = { bookId: 1, chapterNo: 2, keywords: ['秩序执行'], queryText: '秩序执行 青岳宗', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const itemParams = { bookId: 1, chapterNo: 2, keywords: ['身份凭证'], queryText: '身份凭证 黑铁令', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const relationParams = { bookId: 1, chapterNo: 2, keywords: ['互相试探'], queryText: '互相试探 林夜 顾沉舟', manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } };",
      "  const baseWorldContext = await baseService.retrievePlanContext(worldSettingParams);",
      "  const wiredWorldContext = await wiredService.retrievePlanContext(worldSettingParams);",
      "  const baseFactionContext = await baseService.retrievePlanContext(factionParams);",
      "  const wiredFactionContext = await wiredService.retrievePlanContext(factionParams);",
      "  const baseItemContext = await baseService.retrievePlanContext(itemParams);",
      "  const wiredItemContext = await wiredService.retrievePlanContext(itemParams);",
       "  const baseRelationContext = await baseService.retrievePlanContext(relationParams);",
       "  const wiredRelationContext = await wiredService.retrievePlanContext(relationParams);",
       "  const persistedDocs = await db.selectFrom('retrieval_documents').selectAll().where('book_id', '=', 1).where('layer', '=', 'embedding').orderBy('id', 'asc').execute();",
       "  console.log(JSON.stringify({",
        "    baseWorldSettingCount: baseWorldContext.worldSettings.length,",
        "    wiredWorldSettingReason: wiredWorldContext.worldSettings[0]?.reason ?? null,",
        "    baseFactionCount: baseFactionContext.factions.length,",
        "    wiredFactionReason: wiredFactionContext.factions[0]?.reason ?? null,",
        "    baseItemCount: baseItemContext.items.length,",
        "    wiredItemReason: wiredItemContext.items[0]?.reason ?? null,",
        "    baseRelationCount: baseRelationContext.relations.length,",
        "    wiredRelationReason: wiredRelationContext.relations[0]?.reason ?? null,",
        "    persistedEmbeddingDocCount: persistedDocs.length,",
        "    persistedEmbeddingModel: persistedDocs[0]?.embedding_model ?? null,",
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
  assert.ok(result.persistedEmbeddingDocCount >= 4);
  assert.equal(result.persistedEmbeddingModel, "planning-retrieval-deterministic-v1");
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
    riskReminders: Array<{ text: string }>;
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
      "    queryText: '黑铁令 黑铁盟 林夜',",
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
  assert.ok(result.riskReminders.some((item) => item.text.includes("人物当前位置连续性")));
  assert.ok(result.riskReminders.some((item) => item.text.includes("关键物品的持有者与状态连续性")));
  assert.ok(result.riskReminders.some((item) => item.text.includes("已激活的世界规则")));
});

test("retrieval service passes queryText through to embedding search", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-retrieval-query-text-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ capturedQueryText: string }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 10, current_chapter_count: 1, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  let capturedQueryText = '';",
      "  const service = new RetrievalQueryService(logger, {",
      "    embeddingSearcher: {",
      "      async search(params) {",
      "        capturedQueryText = params.queryText;",
      "        return [];",
      "      },",
      "    },",
      "  });",
      "  await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 2,",
      "    keywords: ['黑铁令'],",
      "    queryText: '黑铁令 宗门旧案 当前身份',",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({ capturedQueryText }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.capturedQueryText, "黑铁令 宗门旧案 当前身份");
});
