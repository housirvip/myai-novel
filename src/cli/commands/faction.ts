import { Command } from "commander";

import { FactionService } from "../../domain/faction/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerFactionCommands(program: Command): void {
  const faction = program.command("faction").description("势力管理");
  faction.helpOption("-h, --help", "查看帮助");
  faction.addHelpCommand("help [command]", "查看命令帮助");

  faction
    .command("create")
    .description("创建势力")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--name <name>", "势力名称")
    .option("--category <category>", "势力分类")
    .option("--coreGoal <text>", "核心目标")
    .option("--description <text>", "描述")
    .option("--leaderCharacterId <id>", "领袖人物 ID")
    .option("--headquarter <text>", "总部/驻地")
    .option("--status <status>", "状态", "active")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("faction.create", async (logger) => {
        const result = await new FactionService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          category: parseOptionalText(options.category as string | undefined),
          coreGoal: parseOptionalText(options.coreGoal as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          leaderCharacterId: parseOptionalNumber(
            options.leaderCharacterId as string | undefined,
            "leaderCharacterId",
          ),
          headquarter: parseOptionalText(options.headquarter as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("list")
    .description("查看某本书的势力列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("faction.list", async (logger) => {
        const result = await new FactionService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("get")
    .description("按 ID 查看势力")
    .requiredOption("--id <id>", "势力 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("faction.get", async (logger) => {
        const result = await new FactionService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("update")
    .description("更新势力")
    .requiredOption("--id <id>", "势力 ID")
    .option("--book <id>", "书籍 ID")
    .option("--name <name>", "势力名称")
    .option("--category <category>", "势力分类")
    .option("--coreGoal <text>", "核心目标")
    .option("--description <text>", "描述")
    .option("--leaderCharacterId <id>", "领袖人物 ID")
    .option("--headquarter <text>", "总部/驻地")
    .option("--status <status>", "状态")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("faction.update", async (logger) => {
        const result = await new FactionService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined),
          coreGoal: parseOptionalText(options.coreGoal as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          leaderCharacterId: parseOptionalNumber(
            options.leaderCharacterId as string | undefined,
            "leaderCharacterId",
          ),
          headquarter: parseOptionalText(options.headquarter as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("delete")
    .description("删除势力")
    .requiredOption("--id <id>", "势力 ID")
    .action(async (options) => {
      await runCliCommand("faction.delete", async (logger) => {
        await new FactionService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted faction ${options.id}`);
      });
    });
}
