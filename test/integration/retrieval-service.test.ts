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
    faction: { content: string };
    item: { content: string };
    relation: { content: string };
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
      "  await db.insertInto('world_settings').values({",
      "    id: 1, book_id: 1, title: '宗门制度', category: '规则', content: '外门弟子凭令牌登记入门', status: 'active', append_notes: null, keywords: '[\"宗门\",\"令牌\"]', created_at: now, updated_at: now,",
      "  }).execute();",
      "  const service = new RetrievalQueryService(logger);",
      "  const context = await service.retrievePlanContext({",
      "    bookId: 1,",
      "    chapterNo: 5,",
      "    keywords: ['林夜', '青岳宗', '黑铁令'],",
      "    manualRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] },",
      "  });",
      "  console.log(JSON.stringify({",
      "    recentChapters: context.recentChapters,",
      "    character: context.characters[0],",
      "    faction: context.factions[0],",
      "    item: context.items[0],",
      "    relation: context.relations[0],",
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
  assert.match(result.faction.content, /description=东境大宗门/);
  assert.match(result.faction.content, /headquarter=青岳山/);
  assert.match(result.item.content, /description=可用于特殊身份核验/);
  assert.match(result.item.content, /status=active/);
  assert.match(result.relation.content, /source=林夜/);
  assert.match(result.relation.content, /target=青岳宗/);
});
