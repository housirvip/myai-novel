import { Command } from "commander";

import { WorldSettingService } from "../../domain/world-setting/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerWorldCommands(program: Command): void {
  const world = program.command("world").description("世界设定管理");
  world.helpOption("-h, --help", "查看帮助");
  world.addHelpCommand("help [command]", "查看命令帮助");

  world
    .command("create")
    .description("创建世界设定")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--title <title>", "设定标题")
    .requiredOption("--category <category>", "设定分类")
    .requiredOption("--content <content>", "设定内容")
    .option("--status <status>", "状态", "active")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("world.create", async (logger) => {
        const result = await new WorldSettingService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          category: options.category as string,
          content: options.content as string,
          status: options.status as string,
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("list")
    .description("查看某本书的世界设定列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("world.list", async (logger) => {
        const result = await new WorldSettingService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("get")
    .description("按 ID 查看世界设定")
    .requiredOption("--id <id>", "世界设定 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("world.get", async (logger) => {
        const result = await new WorldSettingService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("update")
    .description("更新世界设定")
    .requiredOption("--id <id>", "世界设定 ID")
    .option("--book <id>", "书籍 ID")
    .option("--title <title>", "设定标题")
    .option("--category <category>", "设定分类")
    .option("--content <content>", "设定内容")
    .option("--status <status>", "状态")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("world.update", async (logger) => {
        const result = await new WorldSettingService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined) ?? undefined,
          content: parseOptionalText(options.content as string | undefined) ?? undefined,
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("delete")
    .description("删除世界设定")
    .requiredOption("--id <id>", "世界设定 ID")
    .action(async (options) => {
      await runCliCommand("world.delete", async (logger) => {
        await new WorldSettingService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted world setting ${options.id}`);
      });
    });
}
