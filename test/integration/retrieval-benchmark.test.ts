import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runInlineModule } from "../helpers/cli.js";
import {
  evaluateRetrievalBenchmark,
  loadRetrievalBenchmarkFixture,
  RETRIEVAL_BENCHMARK_FIXTURE_NAMES,
} from "../helpers/retrieval-benchmark.js";

test("retrieval benchmark fixtures keep blocking recall high and noise bounded", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-benchmark-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  await seedBenchmarkData(env);

  for (const fixtureName of RETRIEVAL_BENCHMARK_FIXTURE_NAMES) {
    const fixture = await loadRetrievalBenchmarkFixture(fixtureName);
    const context = await runInlineModule(
      [
        "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
        "const logger = { info() {}, error() {}, debug() {} };",
        "const service = new RetrievalQueryService(logger);",
        `const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 5, keywords: ${JSON.stringify(fixture.query.keywords)}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
        "console.log(JSON.stringify(context));",
      ].join("\n"),
      env,
    );

    const result = evaluateRetrievalBenchmark(fixture, context);

    assert.equal(result.fixtureName, fixture.name);

    if (fixture.expectationMode === "baseline_gap") {
      assert.ok(result.blockingRecall < 1 || result.decisionRecall < 1, `${fixture.name} should currently expose a retrieval gap`);
      continue;
    }

    assert.equal(result.blockingRecall, 1, `${fixture.name} blocking recall should stay at 1`);
    assert.ok(result.decisionRecall >= 0.5, `${fixture.name} decision recall should stay usable`);
    assert.ok(result.noiseRatio <= (fixture.expected.maxNoiseRatio ?? 1), `${fixture.name} noise ratio too high`);
  }
});

test("hybrid embedding experiment for world-rule runs end-to-end without regressing blocking recall", async () => {
  const fixture = await loadRetrievalBenchmarkFixture("world-rule");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-benchmark-embedding-"));
  const baselineEnv = createTestEnv(path.join(tempDir, "baseline"));
  const embeddingEnv = createTestEnv(path.join(tempDir, "embedding"), {
    PLANNING_RETRIEVAL_EMBEDDING_ENABLED: "true",
  });

  await runCli(["db", "init"], baselineEnv);
  await seedBenchmarkData(baselineEnv);

  await runCli(["db", "init"], embeddingEnv);
  await seedBenchmarkData(embeddingEnv);

  const baselineContext = await runInlineModule(
    [
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const service = new RetrievalQueryService(logger);",
      `const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 5, keywords: ${JSON.stringify(fixture.query.keywords)}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
      "console.log(JSON.stringify(context));",
    ].join("\n"),
    baselineEnv,
  );

  const embeddingContext = await runInlineModule(
    [
      "import { RetrievalQueryService } from './src/domain/planning/retrieval-service.ts';",
      "import { DeterministicHashEmbeddingProvider } from './src/domain/planning/embedding-provider.ts';",
      "import { HybridEmbeddingSearcher } from './src/domain/planning/embedding-searcher-hybrid.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const searcher = new HybridEmbeddingSearcher(new DeterministicHashEmbeddingProvider());",
      "await searcher.index([",
      `  { entityType: 'world_setting', entityId: 1, chunkKey: 'world_setting:1:summary', model: 'test-embed-v1', text: ${JSON.stringify("设定：宗门制度\n规则摘要：外门弟子凭令牌登记入门")} },`,
      `  { entityType: 'faction', entityId: 1, chunkKey: 'faction:1:summary', model: 'test-embed-v1', text: ${JSON.stringify("势力：青岳宗\n核心目标：维持宗门秩序\n规则执行：负责外门弟子凭令牌登记入门")} },`,
      "]);",
      "const service = new RetrievalQueryService(logger, { embeddingSearcher: searcher });",
      `const context = await service.retrievePlanContext({ bookId: 1, chapterNo: 5, keywords: ${JSON.stringify(fixture.query.keywords)}, manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });`,
      "console.log(JSON.stringify(context));",
    ].join("\n"),
    embeddingEnv,
  );

  const baselineResult = evaluateRetrievalBenchmark(fixture, baselineContext);
  const embeddingResult = evaluateRetrievalBenchmark(fixture, embeddingContext);

  assert.ok(baselineResult.decisionRecall < 1, "baseline world-rule case should still expose a gap");
  assert.equal(embeddingResult.blockingRecall, baselineResult.blockingRecall);
  assert.ok(embeddingResult.decisionRecall >= baselineResult.decisionRecall);
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
