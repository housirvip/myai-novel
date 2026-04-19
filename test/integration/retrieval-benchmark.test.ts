import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { PlanRetrievedContext } from "../../src/domain/planning/types.js";
import { createTestEnv, runCli, runInlineModule } from "../helpers/cli.js";
import {
  evaluateRetrievalBenchmark,
  loadRetrievalBenchmarkFixture,
  RETRIEVAL_BENCHMARK_FIXTURE_NAMES,
} from "../helpers/retrieval-benchmark.js";

const LONGFORM_FIXTURE_NAMES = new Set([
  "long-distance-callback",
  "long-distance-motivation",
  "long-distance-world-rule",
  "dense-entity-ambiguity",
]);

test("retrieval benchmark fixtures keep blocking recall high and noise bounded", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-benchmark-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  await seedBenchmarkData(env);
  await seedLongformBenchmarkData(env);

  for (const fixtureName of RETRIEVAL_BENCHMARK_FIXTURE_NAMES) {
    const fixture = await loadRetrievalBenchmarkFixture(fixtureName);
    const chapterNo = fixture.query.chapterNo ?? 5;
    const bookId = LONGFORM_FIXTURE_NAMES.has(fixtureName) ? 2 : 1;
    const context = await runInlineModule<PlanRetrievedContext>(
      [
        "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
        "const logger = { info() {}, error() {}, debug() {} };",
        "const service = new RetrievalQueryService(logger);",
        `const context = await service.retrievePlanContext({ bookId: ${JSON.stringify(bookId)}, chapterNo: ${JSON.stringify(chapterNo)}, keywords: ${JSON.stringify(fixture.query.keywords)}, queryText: ${JSON.stringify(fixture.query.keywords.join(" "))}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
        "console.log(JSON.stringify(context));",
      ].join("\n"),
      env,
    );

    const result = evaluateRetrievalBenchmark(fixture, context);

    assert.equal(result.fixtureName, fixture.name);

    if (fixture.expectationMode === "baseline_gap") {
      // baseline_gap means the fixture is intentionally kept as a known miss.
      // The benchmark should prove that recall is still incomplete or noise is still too high,
      // so we can track the gap without treating it as a regression failure yet.
      assert.ok(
        result.blockingRecall < 1
          || result.decisionRecall < 1
          || result.noiseRatio > (fixture.expected.maxNoiseRatio ?? 1),
        `${fixture.name} should currently expose a retrieval gap`,
      );
      continue;
    }

    // strict means this fixture is now part of the protected baseline.
    // Blocking recall must stay perfect, decision recall must remain usable,
    // and noise must stay within the fixture-specific bound.
    assert.equal(result.blockingRecall, 1, `${fixture.name} blocking recall should stay at 1`);
    assert.ok(result.decisionRecall >= 0.5, `${fixture.name} decision recall should stay usable`);
    assert.ok(result.noiseRatio <= (fixture.expected.maxNoiseRatio ?? 1), `${fixture.name} noise ratio too high`);
    assert.equal(result.observability.hardConstraintExplainedRatio, 1, `${fixture.name} hard constraints should stay explained`);
    assert.equal(result.observability.priorityAssignmentExplainedRatio, 1, `${fixture.name} priority packets should stay explained`);
  }
});

test("hybrid embedding experiment stays non-regressive across representative strict fixtures", async () => {
  const fixtureNames = ["world-rule", "motivation-immutability", "observer-immutability", "cross-entity-conflict"] as const;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-benchmark-embedding-"));
  const baselineEnv = createTestEnv(path.join(tempDir, "baseline"));
  const embeddingEnv = createTestEnv(path.join(tempDir, "embedding"), {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
  });

  await runCli(["db", "init"], baselineEnv);
  await seedBenchmarkData(baselineEnv);

  await runCli(["db", "init"], embeddingEnv);
  await seedBenchmarkData(embeddingEnv);

  for (const fixtureName of fixtureNames) {
    const fixture = await loadRetrievalBenchmarkFixture(fixtureName);
    const baselineContext = await runInlineModule<PlanRetrievedContext>(
      [
        "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
        "const logger = { info() {}, error() {}, debug() {} };",
        "const service = new RetrievalQueryService(logger);",
        `const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 5, keywords: ${JSON.stringify(fixture.query.keywords)}, queryText: ${JSON.stringify(fixture.query.keywords.join(" "))}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
        "console.log(JSON.stringify(context));",
      ].join("\n"),
      baselineEnv,
    );

    const embeddingContext = await runInlineModule<PlanRetrievedContext>(
      [
        "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
        "import { DeterministicHashEmbeddingProvider } from './src/domain/planning/embedding-provider.ts';",
        "import { EmbeddingRefreshService } from './src/domain/planning/embedding-refresh.ts';",
        "import { InMemoryEmbeddingStore } from './src/domain/planning/embedding-store.ts';",
        "import { HybridEmbeddingSearcher } from './src/domain/planning/embedding-searcher-hybrid.ts';",
        "const logger = { info() {}, error() {}, debug() {} };",
        "const provider = new DeterministicHashEmbeddingProvider();",
        "const store = new InMemoryEmbeddingStore();",
        "const refresh = new EmbeddingRefreshService(provider, store);",
        "await refresh.refresh({",
        "  model: 'test-embed-v1',",
        "  characters: [{ id: 1, name: '林夜', goal: '查清黑铁令来历', background: '寒门出身' }, { id: 2, name: '顾沉舟', goal: '暗中观察黑铁令持有者', background: '曾目睹同门背叛事件' }],",
        "  hooks: [{ id: 1, title: '黑铁令身份核验', description: '执事会对黑铁令来源起疑', target_chapter_no: 5 }],",
        "  worldSettings: [{ id: 1, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门' }],",
        "});",
        "const searcher = new HybridEmbeddingSearcher(provider);",
        "searcher.loadIndexedDocuments(await store.listDocuments({ model: 'test-embed-v1' }));",
        "const service = new RetrievalQueryService(logger, { embeddingSearcher: searcher });",
        `const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 5, keywords: ${JSON.stringify(fixture.query.keywords)}, queryText: ${JSON.stringify(fixture.query.keywords.join(" "))}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
        "console.log(JSON.stringify(context));",
      ].join("\n"),
      embeddingEnv,
    );

    const baselineResult = evaluateRetrievalBenchmark(fixture, baselineContext);
    const embeddingResult = evaluateRetrievalBenchmark(fixture, embeddingContext);

    assert.equal(baselineResult.blockingRecall, 1, `${fixture.name} baseline blocking recall should stay at 1`);
    assert.equal(baselineResult.decisionRecall, 1, `${fixture.name} baseline decision recall should stay at 1`);
    assert.equal(embeddingResult.blockingRecall, baselineResult.blockingRecall, `${fixture.name} embedding should not reduce blocking recall`);
    assert.ok(embeddingResult.decisionRecall >= baselineResult.decisionRecall, `${fixture.name} embedding should not reduce decision recall`);
    assert.equal(baselineResult.observability.hardConstraintExplainedRatio, 1, `${fixture.name} baseline hard constraints should stay explained`);
    assert.equal(embeddingResult.observability.hardConstraintExplainedRatio, 1, `${fixture.name} embedding hard constraints should stay explained`);
    assert.equal(baselineResult.observability.priorityAssignmentExplainedRatio, 1, `${fixture.name} baseline priority packets should stay explained`);
    assert.equal(embeddingResult.observability.priorityAssignmentExplainedRatio, 1, `${fixture.name} embedding priority packets should stay explained`);
  }
});

async function seedBenchmarkData(env: NodeJS.ProcessEnv): Promise<void> {
  await runInlineModule(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '测试书', summary: null, target_chapter_count: 100, current_chapter_count: 2, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values([",
      "    { id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: '第一章正式总结', word_count: 1000, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_no: 2, title: '第二章', summary: '第二章草稿总结', word_count: 1200, status: 'drafted', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 1, book_id: 1, name: '林夜', alias: '夜哥', gender: '男', age: 16, personality: '冷静谨慎', background: '寒门出身，曾遭同伴背叛', current_location: '青岳宗外门', status: 'alive', professions: '[\"弟子\"]', levels: '[\"炼气三层\"]', currencies: null, abilities: '[\"感知增强\"]', goal: '查清黑铁令来历', append_notes: '最近得到黑铁令', keywords: '[\"林夜\",\"黑铁令\",\"怀疑\"]', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, name: '顾沉舟', alias: null, gender: '男', age: 22, personality: '审慎', background: '曾目睹同门背叛事件', current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '暗中观察黑铁令持有者', append_notes: '对林夜保持试探', keywords: '[\"顾沉舟\",\"背叛\",\"试探\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('factions').values({ id: 1, book_id: 1, name: '青岳宗', category: '宗门', core_goal: '维持宗门秩序', description: '东境大宗门', leader_character_id: null, headquarter: '青岳山', status: 'active', append_notes: '外门局势紧张', keywords: '[\"青岳宗\",\"外门\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('items').values({ id: 1, book_id: 1, name: '黑铁令', category: '令牌', description: '可用于特殊身份核验', owner_type: 'character', owner_id: 1, rarity: 'unknown', status: 'active', append_notes: '会引起执事异常反应', keywords: '[\"黑铁令\",\"令牌\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('relations').values({ id: 1, book_id: 1, source_type: 'character', source_id: 1, target_type: 'faction', target_id: 1, relation_type: 'member', intensity: 60, status: 'active', description: '林夜已经进入青岳宗外门', append_notes: '关系刚建立', keywords: '[\"关系\",\"入宗\",\"成员\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('story_hooks').values({ id: 1, book_id: 1, title: '黑铁令身份核验', hook_type: '伏笔', description: '执事会对黑铁令来源起疑', source_chapter_no: 2, target_chapter_no: 5, status: 'open', importance: 'high', append_notes: '第五章必须承接', keywords: '[\"黑铁令\",\"执事\"]', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('world_settings').values({ id: 1, book_id: 1, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门', status: 'active', append_notes: null, keywords: '[\"宗门\",\"令牌\"]', created_at: now, updated_at: now }).execute();",
      "  console.log(JSON.stringify({ ok: true }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );
}

async function seedLongformBenchmarkData(env: NodeJS.ProcessEnv): Promise<void> {
  await runInlineModule(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-10T15:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 2, title: '长篇测试书', summary: null, target_chapter_count: 3000, current_chapter_count: 119, status: 'writing', metadata: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values([",
      "    { id: 101, book_id: 2, chapter_no: 12, title: '第十二章', summary: '顾沉舟在旧案档案中第一次见到黑铁令相关记录。', word_count: 1600, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, chapter_no: 37, title: '第三十七章', summary: '档案封存律阻止林夜直接调阅旧案卷宗。', word_count: 1800, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 103, book_id: 2, chapter_no: 58, title: '第五十八章', summary: '黑铁副令出现，宗门内部开始流传伪令牌传闻。', word_count: 1900, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 104, book_id: 2, chapter_no: 79, title: '第七十九章', summary: '顾沉舟因旧日背叛案而迟迟不愿完全信任林夜。', word_count: 2200, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 105, book_id: 2, chapter_no: 101, title: '第一百零一章', summary: '执事档案库再次提起黑铁令旧案，但未给出完整答案。', word_count: 2100, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 106, book_id: 2, chapter_no: 118, title: '第一百一十八章', summary: '林夜意识到旧案并未结束，黑铁令身份核验只是更大回收链的一环。', word_count: 2300, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now },",
      "    { id: 107, book_id: 2, chapter_no: 119, title: '第一百一十九章', summary: '林夜准备在不触发封存律的前提下追查执事档案库。', word_count: 2400, status: 'approved', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 101, book_id: 2, name: '林夜', alias: '夜哥', gender: '男', age: 16, personality: '冷静谨慎', background: '寒门出身，曾遭同伴背叛', current_location: '青岳宗外门', status: 'alive', professions: '[\"弟子\"]', levels: '[\"炼气三层\"]', currencies: null, abilities: '[\"感知增强\"]', goal: '查清黑铁令来历', append_notes: '最近得到黑铁令', keywords: '[\"林夜\",\"黑铁令\",\"怀疑\"]', created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, name: '顾沉舟', alias: null, gender: '男', age: 22, personality: '审慎', background: '曾目睹同门背叛事件', current_location: '执事区', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '暗中观察黑铁令持有者', append_notes: '对林夜保持试探', keywords: '[\"顾沉舟\",\"背叛\",\"试探\"]', created_at: now, updated_at: now },",
      "    { id: 103, book_id: 2, name: '苏砚', alias: null, gender: '女', age: 21, personality: '克制', background: '出身档案吏世家', current_location: '执事档案库', status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: '守住旧案卷宗', append_notes: '知道黑铁令副令的去向', keywords: '[\"苏砚\",\"档案库\",\"旧案\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('factions').values([",
      "    { id: 101, book_id: 2, name: '青岳宗', category: '宗门', core_goal: '维持宗门秩序', description: '东境大宗门', leader_character_id: null, headquarter: '青岳山', status: 'active', append_notes: '外门局势紧张', keywords: '[\"青岳宗\",\"外门\"]', created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, name: '执事档案库', category: '机构', core_goal: '封存旧案与敏感卷宗', description: '掌管宗门旧档与核验记录', leader_character_id: null, headquarter: '执事区', status: 'active', append_notes: '与黑铁令旧案直接相关', keywords: '[\"档案库\",\"旧案\",\"封存\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('items').values([",
      "    { id: 101, book_id: 2, name: '黑铁令', category: '令牌', description: '可用于特殊身份核验', owner_type: 'character', owner_id: 101, rarity: 'unknown', status: 'active', append_notes: '会引起执事异常反应', keywords: '[\"黑铁令\",\"令牌\"]', created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, name: '黑铁副令', category: '令牌', description: '与黑铁令极其相似的副令', owner_type: 'faction', owner_id: 102, rarity: 'rare', status: 'active', append_notes: '常被误认为黑铁令本体', keywords: '[\"黑铁\",\"副令\",\"令牌\"]', created_at: now, updated_at: now },",
      "    { id: 103, book_id: 2, name: '黑铁旁听牌', category: '牌符', description: '用于出入档案侧厅的旁听凭牌', owner_type: 'faction', owner_id: 102, rarity: 'rare', status: 'active', append_notes: '名称与黑铁令体系高度相近', keywords: '[\"黑铁\",\"旁听\",\"牌\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('relations').values([",
      "    { id: 101, book_id: 2, source_type: 'character', source_id: 101, target_type: 'faction', target_id: 101, relation_type: 'member', intensity: 60, status: 'active', description: '林夜已经进入青岳宗外门', append_notes: '关系刚建立', keywords: '[\"关系\",\"入宗\",\"成员\"]', created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, source_type: 'character', source_id: 102, target_type: 'character', target_id: 101, relation_type: 'observer', intensity: 68, status: '互相试探', description: '顾沉舟因旧案线索对林夜持续保持试探', append_notes: '背叛旧案使他不愿完全信任任何持令者', keywords: '[\"顾沉舟\",\"试探\",\"旧案\"]', created_at: now, updated_at: now },",
      "    { id: 103, book_id: 2, source_type: 'character', source_id: 103, target_type: 'faction', target_id: 102, relation_type: 'keeper', intensity: 72, status: 'active', description: '苏砚负责保管执事档案库中的旧案卷宗', append_notes: '对封存律执行非常严格', keywords: '[\"苏砚\",\"档案库\",\"封存\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('story_hooks').values([",
      "    { id: 101, book_id: 2, title: '黑铁令旧案回收', hook_type: '伏笔', description: '黑铁令与被封存的宗门旧案将在后期重新被追查', source_chapter_no: 12, target_chapter_no: 120, status: 'progressing', importance: 'high', append_notes: '远距离伏笔，要求长线承接', keywords: '[\"黑铁令\",\"旧案\",\"回收\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  await db.insertInto('world_settings').values([",
      "    { id: 101, book_id: 2, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门', status: 'active', append_notes: null, keywords: '[\"宗门\",\"令牌\"]', created_at: now, updated_at: now },",
      "    { id: 102, book_id: 2, title: '档案封存律', category: '规则', content: '涉及旧案的卷宗只有执事档案库核准后方可调阅，擅开者视为重罪', status: 'active', append_notes: '与黑铁令旧案直接相关', keywords: '[\"封存\",\"旧案\",\"规则\"]', created_at: now, updated_at: now }",
      "  ]).execute();",
      "  console.log(JSON.stringify({ ok: true }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );
}
