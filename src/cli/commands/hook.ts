import { Command } from "commander";

import { StoryHookService } from "../../domain/story-hook/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerHookCommands(program: Command): void {
  const hook = program.command("hook").description("故事钩子管理");
  hook.helpOption("-h, --help", "查看帮助");
  hook.addHelpCommand("help [command]", "查看命令帮助");

  hook
    .command("create")
    .description("创建故事钩子")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--title <title>", "钩子标题")
    .option("--hookType <type>", "钩子类型")
    .option("--description <text>", "描述")
    .option("--sourceChapter <number>", "来源章节号")
    .option("--targetChapter <number>", "目标章节号")
    .option("--status <status>", "状态", "open")
    .option("--importance <level>", "重要度")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("hook.create", async (logger) => {
        const result = await new StoryHookService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          hookType: parseOptionalText(options.hookType as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          sourceChapterNo: parseOptionalNumber(options.sourceChapter as string | undefined, "sourceChapter"),
          targetChapterNo: parseOptionalNumber(options.targetChapter as string | undefined, "targetChapter"),
          status: options.status as string,
          importance: parseOptionalText(options.importance as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("list")
    .description("查看某本书的故事钩子列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("hook.list", async (logger) => {
        const result = await new StoryHookService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("get")
    .description("按 ID 查看故事钩子")
    .requiredOption("--id <id>", "故事钩子 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("hook.get", async (logger) => {
        const result = await new StoryHookService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("update")
    .description("更新故事钩子")
    .requiredOption("--id <id>", "故事钩子 ID")
    .option("--book <id>", "书籍 ID")
    .option("--title <title>", "钩子标题")
    .option("--hookType <type>", "钩子类型")
    .option("--description <text>", "描述")
    .option("--sourceChapter <number>", "来源章节号")
    .option("--targetChapter <number>", "目标章节号")
    .option("--status <status>", "状态")
    .option("--importance <level>", "重要度")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("hook.update", async (logger) => {
        const result = await new StoryHookService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          hookType: parseOptionalText(options.hookType as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          sourceChapterNo: parseOptionalNumber(options.sourceChapter as string | undefined, "sourceChapter"),
          targetChapterNo: parseOptionalNumber(options.targetChapter as string | undefined, "targetChapter"),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          importance: parseOptionalText(options.importance as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("delete")
    .description("删除故事钩子")
    .requiredOption("--id <id>", "故事钩子 ID")
    .action(async (options) => {
      await runCliCommand("hook.delete", async (logger) => {
        await new StoryHookService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted story hook ${options.id}`);
      });
    });
}
