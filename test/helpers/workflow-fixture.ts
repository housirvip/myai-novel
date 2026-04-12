import fs from "node:fs/promises";
import path from "node:path";

import { runCli, runCliJson } from "./cli.js";

export interface WorkflowSnapshot {
  plan: {
    intentSource: string;
    intentSummary: string;
    mustInclude: string[];
    mustAvoid: string[];
    relationCount: number;
  };
  approve: {
    finalId: number;
    relationIds: number[];
    hookIds: number[];
  };
  chapter: {
    status: string;
    currentFinalId: number;
    actualHookIds: number[];
    actualWorldSettingIds: number[];
    summary?: string;
    wordCount?: number;
  };
  relation: {
    intensity: number;
    description: string;
    appendNotes: string;
  };
  book: {
    currentChapterCount: number;
  };
}

export async function runWorkflowFixture(input: {
  env: NodeJS.ProcessEnv;
  tempDir: string;
  chapterNo: number;
  titlePrefix: string;
  exportAndImportFinal?: boolean;
  importSummary?: string;
  importContentLine?: string;
}): Promise<WorkflowSnapshot> {
  const { env, tempDir, chapterNo, titlePrefix } = input;
  const finalPath = path.join(tempDir, `${titlePrefix}-final.md`);

  await runCli(["db", "init"], env);

  const book = await runCliJson<{ id: number }>(
    ["book", "create", "--title", `${titlePrefix}测试书`],
    env,
  );

  await runCliJson(
    ["chapter", "create", "--book", String(book.id), "--chapter", String(chapterNo), "--title", `第${chapterNo}章`],
    env,
  );
  await runCliJson(
    [
      "outline",
      "create",
      "--book",
      String(book.id),
      "--title",
      `${titlePrefix}大纲`,
      "--chapterStart",
      String(chapterNo),
      "--chapterEnd",
      String(chapterNo),
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
      String(chapterNo),
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

  await runCliJson(["draft", "--book", String(book.id), "--chapter", String(chapterNo), "--provider", "mock"], env);
  await runCliJson(["review", "--book", String(book.id), "--chapter", String(chapterNo), "--provider", "mock"], env);
  await runCliJson(["repair", "--book", String(book.id), "--chapter", String(chapterNo), "--provider", "mock"], env);
  const approve = await runCliJson<{
    finalId: number;
    createdEntities: { hooks: number[]; relations: number[] };
  }>(["approve", "--book", String(book.id), "--chapter", String(chapterNo), "--provider", "mock"], env);

  let importedChapter:
    | {
        status: string;
        current_final_id: number;
        summary: string;
        word_count: number;
      }
    | undefined;

  if (input.exportAndImportFinal) {
    await runCliJson(
      ["chapter", "export", "--book", String(book.id), "--chapter", String(chapterNo), "--stage", "final", "--output", finalPath],
      env,
    );

    const exportedFinal = await fs.readFile(finalPath, "utf8");
    const editedFinal = exportedFinal.replace(
      /## Summary\s*\n([\s\S]*?)\n## Content\s*\n/,
      `## Summary\n\n${input.importSummary ?? `${titlePrefix}导入摘要。`}\n\n## Content\n`,
    ).replace("## Content\n", `## Content\n\n${input.importContentLine ?? `补写一段 ${titlePrefix} 导入内容。`}\n\n`);
    await fs.writeFile(finalPath, editedFinal, "utf8");

    importedChapter = await runCliJson<{
      status: string;
      current_final_id: number;
      summary: string;
      word_count: number;
    }>(
      ["chapter", "import", "--book", String(book.id), "--chapter", String(chapterNo), "--stage", "final", "--input", finalPath],
      env,
    );
  }

  const chapter = await runCliJson<{
    status: string;
    current_final_id: number;
    actual_hook_ids: string;
    actual_world_setting_ids: string;
  }>(["chapter", "get", "--book", String(book.id), "--chapter", String(chapterNo)], env);

  const relationRecord = await runCliJson<{
    intensity: number;
    description: string;
    append_notes: string;
  }>(["relation", "get", "--id", String(relation.id)], env);

  const bookState = await runCliJson<{ current_chapter_count: number }>(
    ["book", "get", "--id", String(book.id)],
    env,
  );

  return {
    plan: {
      intentSource: plan.intentSource,
      intentSummary: plan.intentSummary,
      mustInclude: plan.mustInclude,
      mustAvoid: plan.mustAvoid,
      relationCount: plan.retrievedContext.relations.length,
    },
    approve: {
      finalId: approve.finalId,
      relationIds: approve.createdEntities.relations,
      hookIds: approve.createdEntities.hooks,
    },
    chapter: {
      status: importedChapter?.status ?? chapter.status,
      currentFinalId: importedChapter?.current_final_id ?? chapter.current_final_id,
      actualHookIds: JSON.parse(chapter.actual_hook_ids),
      actualWorldSettingIds: JSON.parse(chapter.actual_world_setting_ids),
      summary: importedChapter?.summary,
      wordCount: importedChapter?.word_count,
    },
    relation: {
      intensity: relationRecord.intensity,
      description: relationRecord.description,
      appendNotes: relationRecord.append_notes,
    },
    book: {
      currentChapterCount: bookState.current_chapter_count,
    },
  };
}
