import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv } from "../helpers/cli.js";
import { createMysqlTestContext } from "../helpers/mysql.js";
import { runWorkflowFixture } from "../helpers/workflow-fixture.js";

test("sqlite and mysql keep core workflow results aligned", async () => {
  const sqliteTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-sqlite-parity-"));
  const sqliteEnv = createTestEnv(sqliteTempDir);
  const mysqlContext = await createMysqlTestContext("myai-novel-mysql-parity");

  try {
    const [sqliteSnapshot, mysqlSnapshot] = await Promise.all([
      runWorkflowFixture({
        env: sqliteEnv,
        tempDir: sqliteTempDir,
        chapterNo: 2,
        titlePrefix: "SQLite",
        exportAndImportFinal: true,
        importSummary: "双方言对照导入摘要。",
        importContentLine: "补写一段双方言对照导入内容。",
      }),
      runWorkflowFixture({
        env: mysqlContext.env,
        tempDir: mysqlContext.tempDir,
        chapterNo: 2,
        titlePrefix: "MySQL",
        exportAndImportFinal: true,
        importSummary: "双方言对照导入摘要。",
        importContentLine: "补写一段双方言对照导入内容。",
      }),
    ]);

    assert.equal(sqliteSnapshot.plan.intentSource, mysqlSnapshot.plan.intentSource);
    assert.deepEqual(sqliteSnapshot.plan.mustInclude, mysqlSnapshot.plan.mustInclude);
    assert.deepEqual(sqliteSnapshot.plan.mustAvoid, mysqlSnapshot.plan.mustAvoid);
    assert.equal(sqliteSnapshot.plan.relationCount, mysqlSnapshot.plan.relationCount);

    assert.equal(sqliteSnapshot.approve.relationIds.length, mysqlSnapshot.approve.relationIds.length);
    assert.equal(sqliteSnapshot.approve.hookIds.length, mysqlSnapshot.approve.hookIds.length);

    assert.equal(sqliteSnapshot.chapter.status, mysqlSnapshot.chapter.status);
    assert.deepEqual(sqliteSnapshot.chapter.actualHookIds, mysqlSnapshot.chapter.actualHookIds);
    assert.deepEqual(sqliteSnapshot.chapter.actualWorldSettingIds, mysqlSnapshot.chapter.actualWorldSettingIds);
    assert.equal(sqliteSnapshot.chapter.summary, mysqlSnapshot.chapter.summary);
    assert.ok((sqliteSnapshot.chapter.wordCount ?? 0) > 0);
    assert.equal(sqliteSnapshot.chapter.wordCount, mysqlSnapshot.chapter.wordCount);

    assert.equal(sqliteSnapshot.relation.intensity, mysqlSnapshot.relation.intensity);
    assert.match(sqliteSnapshot.relation.description, /外门弟子身份进入青岳宗/);
    assert.equal(sqliteSnapshot.relation.description, mysqlSnapshot.relation.description);
    assert.equal(sqliteSnapshot.relation.appendNotes, mysqlSnapshot.relation.appendNotes);

    assert.equal(sqliteSnapshot.book.currentChapterCount, mysqlSnapshot.book.currentChapterCount);
  } finally {
    await fs.rm(sqliteTempDir, { recursive: true, force: true });
    await mysqlContext.cleanup();
  }
});
