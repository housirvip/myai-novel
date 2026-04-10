import { Command } from "commander";

import { OutlineService } from "../../domain/outline/service.js";
import { printData } from "../../shared/utils/output.js";
import { parseOptionalNumber, parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { runCliCommand } from "../runtime.js";

export function registerOutlineCommands(program: Command): void {
  const outline = program.command("outline").description("大纲管理");
  outline.helpOption("-h, --help", "查看帮助");
  outline.addHelpCommand("help [command]", "查看命令帮助");

  outline
    .command("create")
    .description("创建大纲")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--title <title>", "大纲标题")
    .option("--volumeNo <number>", "分卷编号")
    .option("--volumeTitle <title>", "分卷标题")
    .option("--chapterStart <number>", "起始章节号")
    .option("--chapterEnd <number>", "结束章节号")
    .option("--level <level>", "大纲层级", "chapter_arc")
    .option("--storyCore <text>", "核心剧情")
    .option("--mainPlot <text>", "主线剧情")
    .option("--subPlot <text>", "支线剧情")
    .option("--foreshadowing <text>", "伏笔")
    .option("--expectedPayoff <text>", "预期回收")
    .option("--notes <text>", "备注")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("outline.create", async (logger) => {
        const result = await new OutlineService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          volumeNo: parseOptionalNumber(options.volumeNo as string | undefined, "volumeNo"),
          volumeTitle: parseOptionalText(options.volumeTitle as string | undefined),
          chapterStartNo: parseOptionalNumber(options.chapterStart as string | undefined, "chapterStart"),
          chapterEndNo: parseOptionalNumber(options.chapterEnd as string | undefined, "chapterEnd"),
          outlineLevel: options.level as string,
          storyCore: parseOptionalText(options.storyCore as string | undefined),
          mainPlot: parseOptionalText(options.mainPlot as string | undefined),
          subPlot: parseOptionalText(options.subPlot as string | undefined),
          foreshadowing: parseOptionalText(options.foreshadowing as string | undefined),
          expectedPayoff: parseOptionalText(options.expectedPayoff as string | undefined),
          notes: parseOptionalText(options.notes as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("list")
    .description("查看某本书的大纲列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("outline.list", async (logger) => {
        const result = await new OutlineService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
        );
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("get")
    .description("按 ID 查看大纲")
    .requiredOption("--id <id>", "大纲 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("outline.get", async (logger) => {
        const result = await new OutlineService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("update")
    .description("更新大纲")
    .requiredOption("--id <id>", "大纲 ID")
    .option("--book <id>", "书籍 ID")
    .option("--title <title>", "大纲标题")
    .option("--volumeNo <number>", "分卷编号")
    .option("--volumeTitle <title>", "分卷标题")
    .option("--chapterStart <number>", "起始章节号")
    .option("--chapterEnd <number>", "结束章节号")
    .option("--level <level>", "大纲层级")
    .option("--storyCore <text>", "核心剧情")
    .option("--mainPlot <text>", "主线剧情")
    .option("--subPlot <text>", "支线剧情")
    .option("--foreshadowing <text>", "伏笔")
    .option("--expectedPayoff <text>", "预期回收")
    .option("--notes <text>", "备注")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("outline.update", async (logger) => {
        const result = await new OutlineService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          volumeNo: parseOptionalNumber(options.volumeNo as string | undefined, "volumeNo"),
          volumeTitle: parseOptionalText(options.volumeTitle as string | undefined),
          chapterStartNo: parseOptionalNumber(options.chapterStart as string | undefined, "chapterStart"),
          chapterEndNo: parseOptionalNumber(options.chapterEnd as string | undefined, "chapterEnd"),
          outlineLevel: parseOptionalText(options.level as string | undefined) ?? undefined,
          storyCore: parseOptionalText(options.storyCore as string | undefined),
          mainPlot: parseOptionalText(options.mainPlot as string | undefined),
          subPlot: parseOptionalText(options.subPlot as string | undefined),
          foreshadowing: parseOptionalText(options.foreshadowing as string | undefined),
          expectedPayoff: parseOptionalText(options.expectedPayoff as string | undefined),
          notes: parseOptionalText(options.notes as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("delete")
    .description("删除大纲")
    .requiredOption("--id <id>", "大纲 ID")
    .action(async (options) => {
      await runCliCommand("outline.delete", async (logger) => {
        await new OutlineService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted outline ${options.id}`);
      });
    });
}
