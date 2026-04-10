import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runCli, runCliJson } from "../helpers/cli.js";

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

  const plan = await runCliJson<{ intentSource: string; retrievedContext: { relations: unknown[] } }>(
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
  assert.ok(plan.retrievedContext.relations.length >= 1);

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
