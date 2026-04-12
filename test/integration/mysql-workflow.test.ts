import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { runCli, runCliJson } from "../helpers/cli.js";
import { createMysqlTestContext } from "../helpers/mysql.js";

test("mysql workflow chain and markdown import/export work end-to-end", async () => {
  const context = await createMysqlTestContext("myai-novel-mysql-workflow");
  const { env, tempDir, cleanup } = context;
  const finalPath = path.join(tempDir, "mysql-final.md");

  try {
    await runCli(["db", "init"], env);

    const book = await runCliJson<{ id: number }>(
      ["book", "create", "--title", "MySQL自动化测试书"],
      env,
    );

    await runCliJson(
      ["chapter", "create", "--book", String(book.id), "--chapter", "1", "--title", "第一章"],
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
        "主角入场并埋下黑铁令线索",
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
        "规则",
        "--content",
        "外门弟子凭令牌登记入门。",
      ],
      env,
    );
    const character = await runCliJson<{ id: number }>(
      ["character", "create", "--book", String(book.id), "--name", "林夜", "--status", "alive"],
      env,
    );
    const faction = await runCliJson<{ id: number }>(
      ["faction", "create", "--book", String(book.id), "--name", "青岳宗", "--status", "active"],
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
      ["item", "create", "--book", String(book.id), "--name", "黑铁令", "--ownerType", "none"],
      env,
    );
    const hook = await runCliJson<{ id: number }>(
      ["hook", "create", "--book", String(book.id), "--title", "黑铁令旧案", "--status", "open"],
      env,
    );

    await runCliJson(
      [
        "plan",
        "--book",
        String(book.id),
        "--chapter",
        "1",
        "--provider",
        "mock",
        "--authorIntent",
        "推进主角入宗并建立黑铁令主线冲突。",
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

    await runCliJson(["draft", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
    await runCliJson(["review", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
    await runCliJson(["repair", "--book", String(book.id), "--chapter", "1", "--provider", "mock"], env);
    const approve = await runCliJson<{ finalId: number }>(
      ["approve", "--book", String(book.id), "--chapter", "1", "--provider", "mock"],
      env,
    );

    await runCliJson(
      ["chapter", "export", "--book", String(book.id), "--chapter", "1", "--stage", "final", "--output", finalPath],
      env,
    );

    const exportedFinal = await fs.readFile(finalPath, "utf8");
    const editedFinal = exportedFinal.replace(
      /## Summary\s*\n([\s\S]*?)\n## Content\s*\n/,
      "## Summary\n\nMySQL 自动化导入摘要。\n\n## Content\n",
    ).replace("## Content\n", "## Content\n\n补写一段 MySQL 自动化导入内容。\n\n");
    await fs.writeFile(finalPath, editedFinal, "utf8");

    const chapterAfterImport = await runCliJson<{
      status: string;
      current_final_id: number;
      summary: string;
      word_count: number;
    }>(
      ["chapter", "import", "--book", String(book.id), "--chapter", "1", "--stage", "final", "--input", finalPath],
      env,
    );

    assert.equal(chapterAfterImport.status, "approved");
    assert.ok(chapterAfterImport.current_final_id > approve.finalId);
    assert.equal(chapterAfterImport.summary, "MySQL 自动化导入摘要。");
    assert.ok(chapterAfterImport.word_count > 0);

    const bookState = await runCliJson<{ current_chapter_count: number }>(
      ["book", "get", "--id", String(book.id)],
      env,
    );
    assert.equal(bookState.current_chapter_count, 1);
  } finally {
    await cleanup();
  }
});
