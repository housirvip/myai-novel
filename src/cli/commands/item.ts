import { Command } from "commander";

import { ItemService } from "../../domain/item/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerItemCommands(program: Command): void {
  const item = program.command("item").description("物品管理");
  item.helpOption("-h, --help", "查看帮助");
  item.addHelpCommand("help [command]", "查看命令帮助");

  item
    .command("create")
    .description("创建物品")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--name <name>", "物品名称")
    .option("--category <category>", "分类")
    .option("--description <text>", "描述")
    .option("--ownerType <type>", "持有者类型", "none")
    .option("--ownerId <id>", "持有者 ID")
    .option("--rarity <rarity>", "稀有度")
    .option("--status <status>", "状态", "active")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("item.create", async (logger) => {
        const result = await new ItemService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          category: parseOptionalText(options.category as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          ownerType: options.ownerType as string,
          ownerId: parseOptionalNumber(options.ownerId as string | undefined, "ownerId"),
          rarity: parseOptionalText(options.rarity as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("list")
    .description("查看某本书的物品列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("item.list", async (logger) => {
        const result = await new ItemService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("get")
    .description("按 ID 查看物品")
    .requiredOption("--id <id>", "物品 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("item.get", async (logger) => {
        const result = await new ItemService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("update")
    .description("更新物品")
    .requiredOption("--id <id>", "物品 ID")
    .option("--book <id>", "书籍 ID")
    .option("--name <name>", "物品名称")
    .option("--category <category>", "分类")
    .option("--description <text>", "描述")
    .option("--ownerType <type>", "持有者类型")
    .option("--ownerId <id>", "持有者 ID")
    .option("--rarity <rarity>", "稀有度")
    .option("--status <status>", "状态")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("item.update", async (logger) => {
        const result = await new ItemService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          ownerType: parseOptionalText(options.ownerType as string | undefined) ?? undefined,
          ownerId: parseOptionalNumber(options.ownerId as string | undefined, "ownerId"),
          rarity: parseOptionalText(options.rarity as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("delete")
    .description("删除物品")
    .requiredOption("--id <id>", "物品 ID")
    .action(async (options) => {
      await runCliCommand("item.delete", async (logger) => {
        await new ItemService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted item ${options.id}`);
      });
    });
}
