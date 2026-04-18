import { Command } from "commander";

import { ChapterService } from "../../domain/chapter/service.js";
import {
  parseOptionalNumber,
  parseOptionalNumberArrayText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerChapterCommands(program: Command): void {
  const chapter = program.command("chapter").description("章节管理");
  chapter.helpOption("-h, --help", "查看帮助");
  chapter.addHelpCommand("help [command]", "查看命令帮助");

  chapter
    .command("create")
    .description("创建章节")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--title <title>", "章节标题")
    .option("--summary <text>", "章节总结")
    .option("--wordCount <number>", "字数")
    .option("--status <status>", "状态", "todo")
    .option("--characterIds <ids>", "实际出场人物 ID，支持 JSON 数组或逗号分隔")
    .option("--factionIds <ids>", "实际出场势力 ID，支持 JSON 数组或逗号分隔")
    .option("--itemIds <ids>", "实际关联物品 ID，支持 JSON 数组或逗号分隔")
    .option("--hookIds <ids>", "实际关联钩子 ID，支持 JSON 数组或逗号分隔")
    .option("--worldSettingIds <ids>", "实际关联世界设定 ID，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.create", async (logger) => {
        // create 阶段这些 actual_* IDs 作为章节的结构化关联字段一并提交，
        // 适合在创建时直接带入已知的出场人物、势力、物品、钩子和世界设定。
        const result = await new ChapterService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          title: parseOptionalText(options.title as string | undefined),
          summary: parseOptionalText(options.summary as string | undefined),
          wordCount: parseOptionalNumber(options.wordCount as string | undefined, "wordCount"),
          status: options.status as string,
          actualCharacterIds: parseOptionalNumberArrayText(
            options.characterIds as string | undefined,
            "characterIds",
          ),
          actualFactionIds: parseOptionalNumberArrayText(
            options.factionIds as string | undefined,
            "factionIds",
          ),
          actualItemIds: parseOptionalNumberArrayText(options.itemIds as string | undefined, "itemIds"),
          actualHookIds: parseOptionalNumberArrayText(options.hookIds as string | undefined, "hookIds"),
          actualWorldSettingIds: parseOptionalNumberArrayText(
            options.worldSettingIds as string | undefined,
            "worldSettingIds",
          ),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("list")
    .description("查看某本书的章节列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.list", async (logger) => {
        const result = await new ChapterService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("get")
    .description("按书籍和章节号查看章节")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.get", async (logger) => {
        const result = await new ChapterService(logger).get(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.chapter as string, "chapter"),
        );
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("update")
    .description("更新章节")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--title <title>", "章节标题")
    .option("--summary <text>", "章节总结")
    .option("--wordCount <number>", "字数")
    .option("--status <status>", "状态")
    .option("--characterIds <ids>", "实际出场人物 ID，支持 JSON 数组或逗号分隔")
    .option("--factionIds <ids>", "实际出场势力 ID，支持 JSON 数组或逗号分隔")
    .option("--itemIds <ids>", "实际关联物品 ID，支持 JSON 数组或逗号分隔")
    .option("--hookIds <ids>", "实际关联钩子 ID，支持 JSON 数组或逗号分隔")
    .option("--worldSettingIds <ids>", "实际关联世界设定 ID，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.update", async (logger) => {
        // update 里 undefined 表示“不改这个字段”，null 则表示“显式清空”。
        // 这里通过 parseOptional* 系列保持 CLI 入参与 service 更新语义一致。
        const result = await new ChapterService(logger).update({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          title: parseOptionalText(options.title as string | undefined),
          summary: parseOptionalText(options.summary as string | undefined),
          wordCount: parseOptionalNumber(options.wordCount as string | undefined, "wordCount"),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          actualCharacterIds: parseOptionalNumberArrayText(
            options.characterIds as string | undefined,
            "characterIds",
          ),
          actualFactionIds: parseOptionalNumberArrayText(
            options.factionIds as string | undefined,
            "factionIds",
          ),
          actualItemIds: parseOptionalNumberArrayText(options.itemIds as string | undefined, "itemIds"),
          actualHookIds: parseOptionalNumberArrayText(options.hookIds as string | undefined, "hookIds"),
          actualWorldSettingIds: parseOptionalNumberArrayText(
            options.worldSettingIds as string | undefined,
            "worldSettingIds",
          ),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("export")
    .description("导出章节阶段内容为 Markdown")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .requiredOption("--stage <stage>", "阶段：plan | draft | final")
    .requiredOption("--output <path>", "输出路径")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.export", async (logger) => {
        const result = await new ChapterService(logger).exportStage({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          stage: options.stage as "plan" | "draft" | "final",
          outputPath: options.output as string,
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("import")
    .description("从 Markdown 导入章节阶段内容")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .requiredOption("--stage <stage>", "阶段：plan | draft | final")
    .requiredOption("--input <path>", "输入路径")
    .option("--force", "忽略状态保护并强制导入")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("chapter.import", async (logger) => {
        // import 默认遵守阶段状态保护，避免用户把旧稿覆盖到当前有效版本上。
        // 只有显式传 --force 时，才允许跳过这层保护做人工回灌。
        const result = await new ChapterService(logger).importStage({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          stage: options.stage as "plan" | "draft" | "final",
          inputPath: options.input as string,
          force: Boolean(options.force),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("delete")
    .description("删除章节")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .action(async (options) => {
      await runCliCommand("chapter.delete", async (logger) => {
        await new ChapterService(logger).remove(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.chapter as string, "chapter"),
        );
        printData(`Deleted chapter ${options.chapter} from book ${options.book}`);
      });
    });
}
