import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runCliJson, runInlineModule } from "../helpers/cli.js";

test("workflow tier routing picks low mid and high models before provider defaults", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-workflow-routing-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "provider-default-model",
    LLM_LOW_MODEL: "low-tier-model",
    LLM_MID_MODEL: "mid-tier-model",
    LLM_HIGH_MODEL: "high-tier-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    models: string[];
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { PlanChapterWorkflow } from './src/domain/workflows/plan-chapter-workflow.ts';",
      "import { DraftChapterWorkflow } from './src/domain/workflows/draft-chapter-workflow.ts';",
      "import { ReviewChapterWorkflow } from './src/domain/workflows/review-chapter-workflow.ts';",
      "import { RepairChapterWorkflow } from './src/domain/workflows/repair-chapter-workflow.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "const models = [];",
      "globalThis.fetch = async (_url, init) => {",
      "  const body = JSON.parse(String(init?.body ?? '{}'));",
      "  models.push(body.model);",
      "  const combined = Array.isArray(body.messages) ? body.messages.map((message) => String(message.content ?? '')).join('\\n') : '';",
      "  let content = '默认输出';",
      "  if (combined.includes('intentSummary') && combined.includes('mustInclude')) {",
      "    content = JSON.stringify({ intentSummary: '推进当前章节主线并埋下后续冲突', keywords: ['主角', '线索'], mustInclude: ['主角', '关键线索'], mustAvoid: ['设定冲突', '人物失真'] });",
      "  } else if (combined.includes('小说审校助手') || combined.includes('修复建议')) {",
      "    content = JSON.stringify({ summary: '审校摘要', issues: ['问题一'], risks: ['风险一'], continuity_checks: ['校验一'], repair_suggestions: ['建议一'] });",
      "  } else if (combined.includes('结构化事实变更') || combined.includes('updates 中的 entityType')) {",
      "    content = JSON.stringify({ chapterSummary: '摘要', unresolvedImpact: '影响', actualCharacterIds: [], actualFactionIds: [], actualItemIds: [], actualHookIds: [], actualWorldSettingIds: [], newCharacters: [], newFactions: [], newItems: [], newHooks: [], newWorldSettings: [], newRelations: [], updates: [] });",
      "  } else if (combined.includes('小说修稿助手')) {",
      "    content = '修稿正文';",
      "  } else {",
      "    content = '正文输出';",
      "  }",
      "  return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });",
      "};",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '路由测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'planned', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  const plan = await new PlanChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', manualEntityRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  const draft = await new DraftChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai' });",
      "  const review = await new ReviewChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai' });",
      "  const repair = await new RepairChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai' });",
      "  await db.updateTable('chapters').set({ status: 'reviewed', current_plan_id: plan.planId, current_draft_id: repair.draftId, current_review_id: review.reviewId, updated_at: now }).where('id', '=', 1).execute();",
      "  await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai' });",
      "  console.log(JSON.stringify({ models }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.deepEqual(result.models, [
    "mid-tier-model",
    "low-tier-model",
    "mid-tier-model",
    "high-tier-model",
    "low-tier-model",
    "high-tier-model",
    "high-tier-model",
    "low-tier-model",
  ]);
});

test("workflow explicit model override beats tier routing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-workflow-routing-explicit-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "provider-default-model",
    LLM_LOW_MODEL: "low-tier-model",
    LLM_MID_MODEL: "mid-tier-model",
    LLM_HIGH_MODEL: "high-tier-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    models: string[];
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { PlanChapterWorkflow } from './src/domain/workflows/plan-chapter-workflow.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "const models = [];",
      "globalThis.fetch = async (_url, init) => {",
      "  const body = JSON.parse(String(init?.body ?? '{}'));",
      "  models.push(body.model);",
      "  const combined = Array.isArray(body.messages) ? body.messages.map((message) => String(message.content ?? '')).join('\\n') : '';",
      "  const content = combined.includes('intentSummary') && combined.includes('mustInclude') ? JSON.stringify({ intentSummary: '摘要', keywords: ['主角'], mustInclude: ['主角'], mustAvoid: ['失真'] }) : '正文输出';",
      "  return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });",
      "};",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '显式模型覆盖', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'planned', current_plan_id: null, current_draft_id: null, current_review_id: null, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await new PlanChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'manual-model', manualEntityRefs: { characterIds: [], factionIds: [], itemIds: [], hookIds: [], relationIds: [], worldSettingIds: [] } });",
      "  console.log(JSON.stringify({ models }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.deepEqual(result.models, ["manual-model", "manual-model", "manual-model"]);
});

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

  const sidecarState = await runInlineModule<{
    storyEventCount: number;
    storyEventSummary: string | null;
    storyEventUnresolvedImpact: string | null;
    storyEventParticipantEntityRefs: string | null;
    segmentCount: number;
    segmentSourceType: string | null;
    eventDocumentCount: number;
    eventDocumentText: string | null;
    segmentDocumentCount: number;
    retrievalFactCount: number;
    chapterSummaryFact: string | null;
    updateFactCount: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "try {",
      `  const storyEvents = await manager.getClient().selectFrom('story_events').selectAll().where('book_id', '=', ${book.id}).where('chapter_no', '=', 2).execute();`,
      `  const segments = await manager.getClient().selectFrom('chapter_segments').selectAll().where('book_id', '=', ${book.id}).where('chapter_no', '=', 2).execute();`,
      `  const eventDocs = await manager.getClient().selectFrom('retrieval_documents').selectAll().where('book_id', '=', ${book.id}).where('layer', '=', 'event').where('chapter_no', '=', 2).execute();`,
      `  const segmentDocs = await manager.getClient().selectFrom('retrieval_documents').selectAll().where('book_id', '=', ${book.id}).where('layer', '=', 'chapter_segment').where('chapter_no', '=', 2).execute();`,
      `  const retrievalFacts = await manager.getClient().selectFrom('retrieval_facts').selectAll().where('book_id', '=', ${book.id}).where('chapter_no', '=', 2).orderBy('id', 'asc').execute();`,
      "  console.log(JSON.stringify({",
      "    storyEventCount: storyEvents.length,",
      "    storyEventSummary: storyEvents[0]?.summary ?? null,",
      "    storyEventUnresolvedImpact: storyEvents[0]?.unresolved_impact ?? null,",
      "    storyEventParticipantEntityRefs: storyEvents[0]?.participant_entity_refs ?? null,",
      "    segmentCount: segments.length,",
      "    segmentSourceType: segments[0]?.source_type ?? null,",
      "    eventDocumentCount: eventDocs.length,",
      "    eventDocumentText: eventDocs[0]?.text ?? null,",
      "    segmentDocumentCount: segmentDocs.length,",
      "    retrievalFactCount: retrievalFacts.length,",
      "    chapterSummaryFact: retrievalFacts.find((item) => item.fact_type === 'chapter_summary')?.fact_text ?? null,",
      "    updateFactCount: retrievalFacts.filter((item) => item.fact_type !== 'chapter_summary').length,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(sidecarState.storyEventCount, 1);
  assert.ok((sidecarState.storyEventSummary ?? "").length > 0);
  assert.ok((sidecarState.storyEventUnresolvedImpact ?? "").length > 0);
  assert.deepEqual(JSON.parse(sidecarState.storyEventParticipantEntityRefs ?? "[]"), [
    { entityType: "character", entityId: character.id },
    { entityType: "faction", entityId: faction.id },
    { entityType: "item", entityId: item.id },
    { entityType: "hook", entityId: hook.id },
    { entityType: "hook", entityId: approve.createdEntities.hooks[0] },
    { entityType: "world_setting", entityId: world.id },
  ]);
  assert.equal(sidecarState.segmentCount, 1);
  assert.equal(sidecarState.segmentSourceType, "approved");
  assert.equal(sidecarState.eventDocumentCount, 1);
  assert.match(sidecarState.eventDocumentText ?? "", /未收束影响：/);
  assert.equal(sidecarState.segmentDocumentCount, 1);
  assert.ok(sidecarState.retrievalFactCount >= 2);
  assert.ok((sidecarState.chapterSummaryFact ?? "").length > 0);
  assert.ok(sidecarState.updateFactCount >= 1);

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


test("approve rejects disallowed chapter status before writing finals", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-status-gate-"));
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
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '状态门禁测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'drafted', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  try {",
      "    await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "    console.log(JSON.stringify({ errorMessage: 'NO_ERROR' }));",
      "  } catch (error) {",
      "    console.log(JSON.stringify({ errorMessage: error instanceof Error ? error.message : String(error) }));",
      "  }",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.errorMessage, "Chapter status does not allow approve: drafted");
});

test("approve keeps non-approved sidecar artifacts while rewriting approved ones", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-precise-sidecar-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    storyEventCount: number;
    approvedStoryEventCount: number;
    legacyStoryEventCount: number;
    chapterSegmentCount: number;
    approvedSegmentCount: number;
    legacySegmentCount: number;
    retrievalFactCount: number;
    approvedFactCount: number;
    legacyFactCount: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let llmCall = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}');",
      "};",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '精确清理测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('story_events').values([",
      "    { id: 10, book_id: 1, chapter_id: 1, chapter_no: 1, event_type: 'chapter_approval', title: '旧定稿事件', summary: '旧摘要', participant_entity_refs: '[]', location_label: null, trigger_text: 'approve:3', outcome_text: '旧摘要', unresolved_impact: null, hook_refs: '[]', status: 'active', created_at: now, updated_at: now },",
      "    { id: 11, book_id: 1, chapter_id: 1, chapter_no: 1, event_type: 'battle', title: '外部事件', summary: '不应删除', participant_entity_refs: '[]', location_label: null, trigger_text: 'manual:1', outcome_text: '外部事件', unresolved_impact: null, hook_refs: '[]', status: 'active', created_at: now, updated_at: now },",
      "  ]).execute();",
      "  await db.insertInto('chapter_segments').values([",
      "    { id: 20, book_id: 1, chapter_id: 1, chapter_no: 1, segment_index: 0, source_type: 'approved', text: '旧定稿正文', summary: '旧摘要', event_refs: '[10]', metadata: '{}', status: 'active', created_at: now, updated_at: now },",
      "    { id: 21, book_id: 1, chapter_id: 1, chapter_no: 1, segment_index: 1, source_type: 'draft', text: '草稿片段', summary: '不应删除', event_refs: '[]', metadata: '{}', status: 'active', created_at: now, updated_at: now },",
      "  ]).execute();",
      "  await db.insertInto('retrieval_facts').values([",
      "    { id: 30, book_id: 1, chapter_no: 1, entity_type: null, entity_id: null, event_id: 10, fact_type: 'chapter_summary', fact_key: 'chapter:1:1:approved:summary', fact_text: '旧摘要', payload_json: '{}', importance: 90, risk_level: 70, effective_from_chapter_no: 1, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now },",
      "    { id: 31, book_id: 1, chapter_no: 1, entity_type: 'character', entity_id: 99, event_id: 11, fact_type: 'character_update', fact_key: 'character:99:manual:chapter_update:1', fact_text: '手工事实', payload_json: '{}', importance: 50, risk_level: 50, effective_from_chapter_no: 1, effective_to_chapter_no: null, superseded_by_fact_id: null, status: 'active', created_at: now, updated_at: now },",
      "  ]).execute();",
      "  await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  const storyEvents = await db.selectFrom('story_events').selectAll().where('book_id', '=', 1).where('chapter_id', '=', 1).orderBy('id', 'asc').execute();",
      "  const chapterSegments = await db.selectFrom('chapter_segments').selectAll().where('book_id', '=', 1).where('chapter_id', '=', 1).orderBy('id', 'asc').execute();",
      "  const retrievalFacts = await db.selectFrom('retrieval_facts').selectAll().where('book_id', '=', 1).where('chapter_no', '=', 1).orderBy('id', 'asc').execute();",
      "  console.log(JSON.stringify({",
      "    storyEventCount: storyEvents.length,",
      "    approvedStoryEventCount: storyEvents.filter((row) => row.trigger_text?.startsWith('approve:')).length,",
      "    legacyStoryEventCount: storyEvents.filter((row) => row.trigger_text === 'manual:1').length,",
      "    chapterSegmentCount: chapterSegments.length,",
      "    approvedSegmentCount: chapterSegments.filter((row) => row.source_type === 'approved').length,",
      "    legacySegmentCount: chapterSegments.filter((row) => row.source_type === 'draft').length,",
      "    retrievalFactCount: retrievalFacts.length,",
      "    approvedFactCount: retrievalFacts.filter((row) => row.fact_key.includes(':approved:')).length,",
      "    legacyFactCount: retrievalFacts.filter((row) => row.fact_key === 'character:99:manual:chapter_update:1').length,",
      "  }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.storyEventCount, 2);
  assert.equal(result.approvedStoryEventCount, 1);
  assert.equal(result.legacyStoryEventCount, 1);
  assert.equal(result.chapterSegmentCount, 2);
  assert.equal(result.approvedSegmentCount, 1);
  assert.equal(result.legacySegmentCount, 1);
  assert.equal(result.retrievalFactCount, 2);
  assert.equal(result.approvedFactCount, 1);
  assert.equal(result.legacyFactCount, 1);
});

test("approve retrieval facts only include applied updates and skip cross-book actual refs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-applied-updates-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    updatedCount: number;
    factKeys: string[];
    factPayloads: Array<{ sourceType?: string; payload?: Record<string, unknown> }>;
    actualCharacterIds: number[];
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let llmCall = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[1,2],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[{\"entityType\":\"character\",\"entityId\":1,\"action\":\"update_fields\",\"payload\":{\"goal\":\"守住令牌\"}},{\"entityType\":\"character\",\"entityId\":2,\"action\":\"update_fields\",\"payload\":{\"goal\":\"跨书角色\"}},{\"entityType\":\"character\",\"entityId\":999,\"action\":\"update_fields\",\"payload\":{\"goal\":\"不存在角色\"}}]}');",
      "};",
      "try {",
      "  await db.insertInto('books').values([{ id: 1, title: '主书', current_chapter_count: 0, created_at: now, updated_at: now }, { id: 2, title: '他书', current_chapter_count: 0, created_at: now, updated_at: now }]).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values([",
      "    { id: 1, book_id: 1, name: '林夜', alias: null, gender: null, age: null, personality: null, background: null, current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: null, created_at: now, updated_at: now },",
      "    { id: 2, book_id: 2, name: '异书角色', alias: null, gender: null, age: null, personality: null, background: null, current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: null, created_at: now, updated_at: now },",
      "  ]).execute();",
      "  const result = await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  const facts = await db.selectFrom('retrieval_facts').select(['fact_key', 'payload_json']).where('book_id', '=', 1).where('chapter_no', '=', 1).orderBy('id', 'asc').execute();",
      "  const chapter = await db.selectFrom('chapters').select(['actual_character_ids']).where('id', '=', 1).executeTakeFirstOrThrow();",
      "  console.log(JSON.stringify({",
      "    updatedCount: result.updatedCount,",
      "    factKeys: facts.map((row) => row.fact_key),",
      "    factPayloads: facts.map((row) => row.payload_json ? JSON.parse(row.payload_json) : {}),",
      "    actualCharacterIds: JSON.parse(chapter.actual_character_ids ?? '[]'),",
      "  }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.actualCharacterIds, [1]);
  assert.equal(result.factKeys.length, 2);
  assert.match(result.factKeys[0], /chapter:1:1:approved:summary/);
  assert.match(result.factKeys[1], /character:1:approved:chapter_update:1/);
  assert.equal(result.factPayloads[0]?.sourceType, "approved");
  assert.equal(result.factPayloads[1]?.sourceType, "approved");
  assert.deepEqual(result.factPayloads[1]?.payload, { goal: "守住令牌" });
});

test("approve skips invalid owner and leader references from update payloads", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-owned-update-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    updatedCount: number;
    factionLeaderId: number | null;
    itemOwnerType: string;
    itemOwnerId: number | null;
    factKeys: string[];
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let llmCall = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[{\"entityType\":\"faction\",\"entityId\":1,\"action\":\"update_fields\",\"payload\":{\"leader_character_id\":2,\"description\":\"尝试跨书首领\"}},{\"entityType\":\"item\",\"entityId\":1,\"action\":\"update_fields\",\"payload\":{\"owner_type\":\"character\",\"owner_id\":2,\"description\":\"尝试跨书归属\"}}]}');",
      "};",
      "try {",
      "  await db.insertInto('books').values([{ id: 1, title: '主书', current_chapter_count: 0, created_at: now, updated_at: now }, { id: 2, title: '他书', current_chapter_count: 0, created_at: now, updated_at: now }]).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values([{ id: 1, book_id: 1, name: '林夜', alias: null, gender: null, age: null, personality: null, background: null, current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: null, created_at: now, updated_at: now }, { id: 2, book_id: 2, name: '异书角色', alias: null, gender: null, age: null, personality: null, background: null, current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: null, created_at: now, updated_at: now }]).execute();",
      "  await db.insertInto('factions').values({ id: 1, book_id: 1, name: '青岳宗', category: null, core_goal: null, description: '旧描述', leader_character_id: 1, headquarter: null, status: 'active', append_notes: null, keywords: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('items').values({ id: 1, book_id: 1, name: '黑铁令', category: null, description: '旧描述', owner_type: 'character', owner_id: 1, rarity: null, status: 'active', append_notes: null, keywords: null, created_at: now, updated_at: now }).execute();",
      "  const workflowResult = await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  const faction = await db.selectFrom('factions').select(['leader_character_id']).where('id', '=', 1).executeTakeFirstOrThrow();",
      "  const item = await db.selectFrom('items').select(['owner_type', 'owner_id']).where('id', '=', 1).executeTakeFirstOrThrow();",
      "  const facts = await db.selectFrom('retrieval_facts').select(['fact_key']).where('book_id', '=', 1).where('chapter_no', '=', 1).orderBy('id', 'asc').execute();",
      "  console.log(JSON.stringify({ updatedCount: workflowResult.updatedCount, factionLeaderId: faction.leader_character_id, itemOwnerType: item.owner_type, itemOwnerId: item.owner_id, factKeys: facts.map((row) => row.fact_key) }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.updatedCount, 0);
  assert.equal(result.factionLeaderId, 1);
  assert.equal(result.itemOwnerType, "character");
  assert.equal(result.itemOwnerId, 1);
  assert.deepEqual(result.factKeys, ["chapter:1:1:approved:summary"]);
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

test("approve rewrites sidecar artifacts for the same chapter instead of duplicating them", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-sidecar-rewrite-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    firstFinalId: number;
    secondFinalId: number;
    finalVersionCount: number;
    storyEventCount: number;
    chapterSegmentCount: number;
    eventDocCount: number;
    segmentDocCount: number;
    retrievalFactCount: number;
    storyEventSummary: string | null;
    storyEventUnresolvedImpact: string | null;
    storyEventParticipantEntityRefs: string | null;
    eventDocumentText: string | null;
    segmentText: string | null;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let callCount = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  callCount += 1;",
      "  if (callCount === 1) return makeResponse('第一次定稿正文');",
      "  if (callCount === 2) return makeResponse('{\"chapterSummary\":\"第一次摘要\",\"unresolvedImpact\":\"第一次影响\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}');",
      "  if (callCount === 3) return makeResponse('第二次定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"第二次摘要\",\"unresolvedImpact\":\"第二次影响\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}');",
      "};",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '重写测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  const workflow = new ApproveChapterWorkflow(logger);",
      "  const first = await workflow.run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  await db.updateTable('chapters').set({ status: 'reviewed', current_review_id: 1, updated_at: now }).where('id', '=', 1).execute();",
      "  const second = await workflow.run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  const finals = await db.selectFrom('chapter_finals').selectAll().where('chapter_id', '=', 1).execute();",
      "  const storyEvents = await db.selectFrom('story_events').selectAll().where('book_id', '=', 1).where('chapter_id', '=', 1).execute();",
      "  const chapterSegments = await db.selectFrom('chapter_segments').selectAll().where('book_id', '=', 1).where('chapter_id', '=', 1).execute();",
      "  const eventDocs = await db.selectFrom('retrieval_documents').selectAll().where('book_id', '=', 1).where('layer', '=', 'event').where('chapter_no', '=', 1).execute();",
      "  const segmentDocs = await db.selectFrom('retrieval_documents').selectAll().where('book_id', '=', 1).where('layer', '=', 'chapter_segment').where('chapter_no', '=', 1).execute();",
      "  const retrievalFacts = await db.selectFrom('retrieval_facts').selectAll().where('book_id', '=', 1).where('chapter_no', '=', 1).execute();",
      "  console.log(JSON.stringify({",
      "    firstFinalId: first.finalId,",
      "    secondFinalId: second.finalId,",
      "    finalVersionCount: finals.length,",
      "    storyEventCount: storyEvents.length,",
      "    chapterSegmentCount: chapterSegments.length,",
      "    eventDocCount: eventDocs.length,",
      "    segmentDocCount: segmentDocs.length,",
      "    retrievalFactCount: retrievalFacts.length,",
      "    storyEventSummary: storyEvents[0]?.summary ?? null,",
      "    storyEventUnresolvedImpact: storyEvents[0]?.unresolved_impact ?? null,",
      "    storyEventParticipantEntityRefs: storyEvents[0]?.participant_entity_refs ?? null,",
      "    eventDocumentText: eventDocs[0]?.text ?? null,",
      "    segmentText: chapterSegments[0]?.text ?? null,",
      "  }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.ok(result.firstFinalId > 0);
  assert.ok(result.secondFinalId > result.firstFinalId);
  assert.equal(result.finalVersionCount, 2);
  assert.equal(result.storyEventCount, 1);
  assert.equal(result.chapterSegmentCount, 1);
  assert.equal(result.eventDocCount, 1);
  assert.equal(result.segmentDocCount, 1);
  assert.equal(result.retrievalFactCount, 1);
  assert.equal(result.storyEventSummary, "第二次摘要");
  assert.equal(result.storyEventUnresolvedImpact, "第二次影响");
  assert.deepEqual(JSON.parse(result.storyEventParticipantEntityRefs ?? "[]"), []);
  assert.match(result.eventDocumentText ?? "", /未收束影响：第二次影响/);
  assert.match(result.segmentText ?? "", /第二次定稿正文/);
});

test("approve skips invalid relation endpoints from diff", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-relation-endpoint-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    relationCount: number;
    updatedCount: number;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "let llmCall = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[{\"sourceType\":\"character\",\"sourceId\":1,\"targetType\":\"faction\",\"targetId\":2,\"relationType\":\"ally\",\"description\":\"跨书关系\",\"keywords\":[]}],\"updates\":[]}');",
      "};",
      "try {",
      "  await db.insertInto('books').values([{ id: 1, title: '主书', current_chapter_count: 0, created_at: now, updated_at: now }, { id: 2, title: '他书', current_chapter_count: 0, created_at: now, updated_at: now }]).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('characters').values({ id: 1, book_id: 1, name: '林夜', alias: null, gender: null, age: null, personality: null, background: null, current_location: null, status: 'alive', professions: null, levels: null, currencies: null, abilities: null, goal: null, append_notes: null, keywords: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('factions').values({ id: 2, book_id: 2, name: '异书宗门', category: null, core_goal: null, description: null, leader_character_id: null, headquarter: null, status: 'active', append_notes: null, keywords: null, created_at: now, updated_at: now }).execute();",
      "  const workflowResult = await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  const relations = await db.selectFrom('relations').selectAll().execute();",
      "  console.log(JSON.stringify({ relationCount: relations.length, updatedCount: workflowResult.updatedCount }));",
      "} finally {",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.relationCount, 0);
  assert.equal(result.updatedCount, 0);
});

test("approve wraps chapter final version conflicts with retryable message", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-version-conflict-"));
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
      "import { ChapterFinalRepository } from './src/core/db/repositories/chapter-final-repository.ts';",
      "const logger = { info() {}, warn() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "const originalCreate = ChapterFinalRepository.prototype.create;",
      "let llmCall = 0;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}');",
      "};",
      "ChapterFinalRepository.prototype.create = async function () { throw new Error('UNIQUE constraint failed: chapter_finals.chapter_id, chapter_finals.version_no'); };",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '版本冲突测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  try {",
      "    await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "    console.log(JSON.stringify({ errorMessage: 'NO_ERROR' }));",
      "  } catch (error) {",
      "    console.log(JSON.stringify({ errorMessage: error instanceof Error ? error.message : String(error) }));",
      "  }",
      "} finally {",
      "  ChapterFinalRepository.prototype.create = originalCreate;",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.errorMessage, "Chapter final version changed during approve, please retry");
});

test("approve rolls back final and sidecar writes when sidecar persistence fails", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-approve-sidecar-rollback-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
  });

  await runCli(["db", "init"], env);

  const result = await runInlineModule<{
    errorMessage: string;
    finalCount: number;
    storyEventCount: number;
    chapterSegmentCount: number;
    eventDocCount: number;
    retrievalFactCount: number;
    chapterStatus: string;
    currentFinalId: number | null;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "import { ApproveChapterWorkflow } from './src/domain/workflows/approve-chapter-workflow.ts';",
      "import { StoryEventRepository } from './src/core/db/repositories/story-event-repository.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "const db = manager.getClient();",
      "const now = '2026-04-11T00:00:00.000Z';",
      "const originalFetch = globalThis.fetch;",
      "const originalCreate = StoryEventRepository.prototype.create;",
      "const makeResponse = (content) => ({ ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content } }] }), text: async () => JSON.stringify({ model: 'test-model', choices: [{ message: { content } }] }) });",
      "let llmCall = 0;",
      "globalThis.fetch = async () => {",
      "  llmCall += 1;",
      "  if (llmCall === 1) return makeResponse('定稿正文');",
      "  return makeResponse('{\"chapterSummary\":\"摘要\",\"actualCharacterIds\":[],\"actualFactionIds\":[],\"actualItemIds\":[],\"actualHookIds\":[],\"actualWorldSettingIds\":[],\"newCharacters\":[],\"newFactions\":[],\"newItems\":[],\"newHooks\":[],\"newWorldSettings\":[],\"newRelations\":[],\"updates\":[]}');",
      "};",
      "StoryEventRepository.prototype.create = async function () { throw new Error('SIDE_CAR_WRITE_FAILED'); };",
      "try {",
      "  await db.insertInto('books').values({ id: 1, title: '回滚测试', current_chapter_count: 0, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapters').values({ id: 1, book_id: 1, chapter_no: 1, title: '第一章', summary: null, word_count: null, status: 'reviewed', current_plan_id: 1, current_draft_id: 1, current_review_id: 1, current_final_id: null, actual_character_ids: null, actual_faction_ids: null, actual_item_ids: null, actual_hook_ids: null, actual_world_setting_ids: null, created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_plans').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, status: 'active', author_intent: '意图', intent_source: 'user_input', intent_keywords: '[]', manual_entity_refs: '{}', retrieved_context: '{}', content: '计划', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_drafts').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, version_no: 1, based_on_plan_id: 1, based_on_draft_id: null, based_on_review_id: null, status: 'active', content: '草稿', summary: null, word_count: 1000, model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  await db.insertInto('chapter_reviews').values({ id: 1, book_id: 1, chapter_id: 1, chapter_no: 1, draft_id: 1, version_no: 1, status: 'active', summary: 'ok', issues: '[]', risks: '[]', continuity_checks: '[]', repair_suggestions: '[]', raw_result: '{\"summary\":\"ok\"}', model: null, provider: null, source_type: 'ai_generated', created_at: now, updated_at: now }).execute();",
      "  let errorMessage = 'NO_ERROR';",
      "  try {",
      "    await new ApproveChapterWorkflow(logger).run({ bookId: 1, chapterNo: 1, provider: 'openai', model: 'test-model' });",
      "  } catch (error) {",
      "    errorMessage = error instanceof Error ? error.message : String(error);",
      "  }",
      "  const finals = await db.selectFrom('chapter_finals').selectAll().where('chapter_id', '=', 1).execute();",
      "  const storyEvents = await db.selectFrom('story_events').selectAll().where('chapter_id', '=', 1).execute();",
      "  const chapterSegments = await db.selectFrom('chapter_segments').selectAll().where('chapter_id', '=', 1).execute();",
      "  const eventDocs = await db.selectFrom('retrieval_documents').selectAll().where('book_id', '=', 1).where('layer', '=', 'event').execute();",
      "  const retrievalFacts = await db.selectFrom('retrieval_facts').selectAll().where('book_id', '=', 1).execute();",
      "  const chapter = await db.selectFrom('chapters').select(['status', 'current_final_id']).where('id', '=', 1).executeTakeFirstOrThrow();",
      "  console.log(JSON.stringify({ errorMessage, finalCount: finals.length, storyEventCount: storyEvents.length, chapterSegmentCount: chapterSegments.length, eventDocCount: eventDocs.length, retrievalFactCount: retrievalFacts.length, chapterStatus: chapter.status, currentFinalId: chapter.current_final_id }));",
      "} finally {",
      "  StoryEventRepository.prototype.create = originalCreate;",
      "  globalThis.fetch = originalFetch;",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.errorMessage, "SIDE_CAR_WRITE_FAILED");
  assert.equal(result.finalCount, 0);
  assert.equal(result.storyEventCount, 0);
  assert.equal(result.chapterSegmentCount, 0);
  assert.equal(result.eventDocCount, 0);
  assert.equal(result.retrievalFactCount, 0);
  assert.equal(result.chapterStatus, "reviewed");
  assert.equal(result.currentFinalId, null);
});
