import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runCliJson, runInlineModule } from "../helpers/cli.js";

test("mock workflow chain updates chapter facts and related entities", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-workflow-"));
  const env = createTestEnv(tempDir);

  await runCli(["db", "init"], env);

  const book = await runCliJson<{ id: number }>(
    ["book", "create", "--title", "青岳入门录"],
    env,
  );

  await runCliJson(
    ["chapter", "create", "--book", String(book.id), "--chapter", "2", "--title", "黑铁令"],
    env,
  );
  await runCliJson(
    [
      "outline",
      "create",
      "--book",
      String(book.id),
      "--title",
      "外门入宗",
      "--chapterStart",
      "2",
      "--chapterEnd",
      "2",
      "--storyCore",
      "主角拿到异常令牌并进入宗门",
    ],
    env,
  );
  const world = await runCliJson<{ id: number }>(
    [
      "world",
      "create",
      "--book",
      String(book.id),
      "--title",
      "宗门制度",
      "--category",
      "势力规则",
      "--content",
      "外门弟子通过令牌登记入门。",
      "--keywords",
      "宗门,外门,令牌",
    ],
    env,
  );
  const character = await runCliJson<{ id: number }>(
    [
      "character",
      "create",
      "--book",
      String(book.id),
      "--name",
      "林夜",
      "--status",
      "alive",
      "--background",
      "出身寒门",
      "--keywords",
      "林夜,主角",
    ],
    env,
  );
  const faction = await runCliJson<{ id: number }>(
    [
      "faction",
      "create",
      "--book",
      String(book.id),
      "--name",
      "青岳宗",
      "--status",
      "active",
      "--keywords",
      "青岳宗,外门",
    ],
    env,
  );
  const relation = await runCliJson<{ id: number }>(
    [
      "relation",
      "create",
      "--book",
      String(book.id),
      "--sourceType",
      "character",
      "--sourceId",
      String(character.id),
      "--targetType",
      "faction",
      "--targetId",
      String(faction.id),
      "--relationType",
      "member",
      "--keywords",
      "林夜,外门",
    ],
    env,
  );
  const item = await runCliJson<{ id: number }>(
    [
      "item",
      "create",
      "--book",
      String(book.id),
      "--name",
      "黑铁令",
      "--ownerType",
      "none",
      "--status",
      "active",
      "--keywords",
      "黑铁令,令牌",
    ],
    env,
  );
  const hook = await runCliJson<{ id: number }>(
    [
      "hook",
      "create",
      "--book",
      String(book.id),
      "--title",
      "黑铁令异常",
      "--hookType",
      "mystery",
      "--status",
      "open",
      "--keywords",
      "黑铁令,异常",
    ],
    env,
  );

  const plan = await runCliJson<{
    intentSource: string;
    intentSummary: string;
    mustInclude: string[];
    mustAvoid: string[];
    retrievedContext: { relations: unknown[] };
  }>(
    [
      "plan",
      "--book",
      String(book.id),
      "--chapter",
      "2",
      "--provider",
      "mock",
      "--authorIntent",
      "让林夜带着黑铁令入宗，并引出青岳宗旧案线索。",
      "--characterIds",
      String(character.id),
      "--factionIds",
      String(faction.id),
      "--relationIds",
      String(relation.id),
      "--itemIds",
      String(item.id),
      "--hookIds",
      String(hook.id),
      "--worldSettingIds",
      String(world.id),
    ],
    env,
  );
  assert.equal(plan.intentSource, "user_input");
  assert.ok(plan.intentSummary.length > 0);
  assert.ok(plan.mustInclude.length > 0);
  assert.ok(plan.mustAvoid.length > 0);
  assert.ok(plan.retrievedContext.relations.length >= 1);

  const storedPlan = await runInlineModule<{
    intentSummary: string | null;
    mustInclude: string | null;
    mustAvoid: string | null;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "try {",
      `  const row = await manager.getClient().selectFrom('chapter_plans').select(['intent_summary', 'intent_must_include', 'intent_must_avoid']).where('chapter_no', '=', 2).executeTakeFirstOrThrow();`,
      "  console.log(JSON.stringify({",
      "    intentSummary: row.intent_summary,",
      "    mustInclude: row.intent_must_include,",
      "    mustAvoid: row.intent_must_avoid,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );
  assert.equal(storedPlan.intentSummary, plan.intentSummary);
  assert.ok(storedPlan.mustInclude);
  assert.ok(storedPlan.mustAvoid);

  await runCliJson(["draft", "--book", String(book.id), "--chapter", "2", "--provider", "mock"], env);
  await runCliJson(["review", "--book", String(book.id), "--chapter", "2", "--provider", "mock"], env);
  await runCliJson(["repair", "--book", String(book.id), "--chapter", "2", "--provider", "mock"], env);
  const approve = await runCliJson<{
    finalId: number;
    createdEntities: { hooks: number[]; relations: number[] };
  }>(["approve", "--book", String(book.id), "--chapter", "2", "--provider", "mock"], env);

  assert.ok(approve.finalId > 0);
  assert.deepEqual(approve.createdEntities.relations, [relation.id]);
  assert.equal(approve.createdEntities.hooks.length, 1);

  const chapter = await runCliJson<{
    status: string;
    current_final_id: number;
    actual_hook_ids: string;
    actual_world_setting_ids: string;
  }>(["chapter", "get", "--book", String(book.id), "--chapter", "2"], env);
  assert.equal(chapter.status, "approved");
  assert.equal(chapter.current_final_id, approve.finalId);
  assert.deepEqual(JSON.parse(chapter.actual_hook_ids), [hook.id, approve.createdEntities.hooks[0]]);
  assert.deepEqual(JSON.parse(chapter.actual_world_setting_ids), [world.id]);

  const relationRecord = await runCliJson<{
    intensity: number;
    description: string;
    append_notes: string;
  }>(["relation", "get", "--id", String(relation.id)], env);
  assert.equal(relationRecord.intensity, 60);
  assert.match(relationRecord.description, /外门弟子身份进入青岳宗/);
  assert.match(relationRecord.append_notes, /\[Chapter 2\]/);

  const bookState = await runCliJson<{ current_chapter_count: number }>(
    ["book", "get", "--id", String(book.id)],
    env,
  );
  assert.equal(bookState.current_chapter_count, 1);
});


test("approve rejects pointer changes before commit", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-stale-pointer-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{ errorMessage: string }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let callCount = 0;",
      "globalThis.fetch = async () => {",
      "  callCount += 1;",
      "  if (callCount === 1) {",
      "    await db.updateTable('chapters').set({ current_draft_id: 2, updated_at: now }).where('id', '=', 1).execute();",
      "    return new Response(JSON.stringify({ model: 'test-model', choices: [{ message: { content: '定稿内容' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });",
      "  }",
      "  return new Response(JSON.stringify({ model: 'test-model', choices: [{ message: { content: '{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });",
      "};",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '事务边界测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values([",
      "    { id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '旧草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now },",
      "    { id: 2, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 2, based_on_plan_id: 1, based_on_draft_id: 1, based_on_review_id: 1, status: 'active', content: '新草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'repaired', created_at: now, updated_at: now },",
      "  ]).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  try {",
      "    await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "    console.log(JSON.stringify({ errorMessage: 'NO_ERROR' }));",
      "  } catch (error) {",
      "    console.log(JSON.stringify({ errorMessage: error instanceof Error ? error.message : String(error) }));",
      "  }",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.errorMessage, "Current draft pointer changed before commit");
});
