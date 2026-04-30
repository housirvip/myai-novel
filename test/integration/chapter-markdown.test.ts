import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runCliJson, runInlineModule } from "../helpers/cli.js";

test("chapter markdown export/import creates new versions instead of overwriting", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-markdown-"));
  const env = createTestEnv(tempDir);
  const planPath = path.join(tempDir, "chapter-0001-plan.md");
  const finalPath = path.join(tempDir, "chapter-0001-final.md");

  await runCli(["db", "init"], env);

  const book = await runCliJson<{ id: number }>(
    ["book", "create", "--title", "手工修订测试书"],
    env,
  );

  await runCliJson(
    ["chapter", "create", "--book", String(book.id), "--chapter", "1", "--title", "试炼开局"],
    env,
  );
  await runCliJson(
    [
      "outline",
      "create",
      "--book",
      String(book.id),
      "--title",
      "第一章大纲",
      "--chapterStart",
      "1",
      "--chapterEnd",
      "1",
      "--storyCore",
      "开局埋下一个黑铁令钩子",
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
      "宗门规矩",
      "--category",
      "设定",
      "--content",
      "外门入门需要登记。",
    ],
    env,
  );
  const character = await runCliJson<{ id: number }>(
    ["character", "create", "--book", String(book.id), "--name", "林夜"],
    env,
  );
  const faction = await runCliJson<{ id: number }>(
    ["faction", "create", "--book", String(book.id), "--name", "青岳宗"],
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
    ],
    env,
  );
  const item = await runCliJson<{ id: number }>(
    ["item", "create", "--book", String(book.id), "--name", "黑铁令"],
    env,
  );
  const hook = await runCliJson<{ id: number }>(
    ["hook", "create", "--book", String(book.id), "--title", "旧案钩子"],
    env,
  );

  const plan = await runCliJson<{ planId: number }>(
    [
      "plan",
      "--book",
      String(book.id),
      "--chapter",
      "1",
      "--provider",
      "mock",
      "--authorIntent",
      "推进主角开局并埋下黑铁令线索。",
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

  await runCliJson(["chapter", "export", "--book", String(book.id), "--chapter", "1", "--stage", "plan", "--output", planPath], env);
  const exportedPlan = await fs.readFile(planPath, "utf8");
  const editedPlan = exportedPlan.replace(
    "## Content\n\n",
    "## Content\n\n手工补充的 plan 段落。\n\n",
  );
  await fs.writeFile(planPath, editedPlan, "utf8");

  const chapterAfterPlanImport = await runCliJson<{ current_plan_id: number; status: string }>(
    ["chapter", "import", "--book", String(book.id), "--chapter", "1", "--stage", "plan", "--input", planPath],
    env,
  );
  assert.equal(chapterAfterPlanImport.status, "planned");
  assert.ok(chapterAfterPlanImport.current_plan_id > plan.planId);

  const importedPlan = await runInlineModule<{
    authorIntent: string | null;
    intentSummary: string | null;
    intentMustInclude: string | null;
    intentMustAvoid: string | null;
    manualEntityRefs: string | null;
    retrievedContext: string | null;
  }>(
    [
      "import { createDatabaseManager } from './src/core/db/client.ts';",
      "const logger = { info() {}, error() {}, debug() {} };",
      "const manager = createDatabaseManager(logger);",
      "try {",
      `  const row = await manager.getClient().selectFrom('chapter_plans').select(['author_intent', 'intent_summary', 'intent_must_include', 'intent_must_avoid', 'manual_entity_refs', 'retrieved_context']).where('id', '=', ${chapterAfterPlanImport.current_plan_id}).executeTakeFirstOrThrow();`,
      "  console.log(JSON.stringify({",
      "    authorIntent: row.author_intent,",
      "    intentSummary: row.intent_summary,",
      "    intentMustInclude: row.intent_must_include,",
      "    intentMustAvoid: row.intent_must_avoid,",
      "    manualEntityRefs: row.manual_entity_refs,",
      "    retrievedContext: row.retrieved_context,",
      "  }));",
      "} finally {",
      "  await manager.destroy();",
      "}",
    ].join("\n"),
    env,
  );
  assert.equal(importedPlan.authorIntent, "推进主角开局并埋下黑铁令线索。");
  assert.ok(importedPlan.intentSummary);
  assert.ok(importedPlan.intentMustInclude);
  assert.ok(importedPlan.intentMustAvoid);
  assert.ok(importedPlan.manualEntityRefs);
  assert.ok(importedPlan.retrievedContext);

  await runCliJson(["draft", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
  await runCliJson(["review", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
  await runCliJson(["repair", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
  const approve = await runCliJson<{ finalId: number }>(
    ["approve", "--book", String(book.id), "--chapter", "1", "--provider", "mock"],
    env,
  );

  await runCliJson(["chapter", "export", "--book", String(book.id), "--chapter", "1", "--stage", "final", "--output", finalPath], env);
  const exportedFinal = await fs.readFile(finalPath, "utf8");
  const editedFinal = exportedFinal.replace(
    /## Summary\s*\n([\s\S]*?)\n## Content\s*\n/,
    "## Summary\n\n手工调整后的正式稿摘要。\n\n## Content\n",
  ).replace("## Content\n", "## Content\n\n手工补写的一段正式稿内容。\n\n");
  await fs.writeFile(finalPath, editedFinal, "utf8");

  const chapterAfterFinalImport = await runCliJson<{
    current_final_id: number;
    status: string;
    summary: string;
    word_count: number;
  }>(
    ["chapter", "import", "--book", String(book.id), "--chapter", "1", "--stage", "final", "--input", finalPath],
    env,
  );
  assert.equal(chapterAfterFinalImport.status, "approved");
  assert.ok(chapterAfterFinalImport.current_final_id > approve.finalId);
  assert.equal(chapterAfterFinalImport.summary, "手工调整后的正式稿摘要。");
  assert.ok(chapterAfterFinalImport.word_count > 0);

  const bookState = await runCliJson<{ current_chapter_count: number }>(
    ["book", "get", "--id", String(book.id)],
    env,
  );
  assert.equal(bookState.current_chapter_count, 1);
});
