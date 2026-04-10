import { Command } from "commander";

import { RelationService } from "../../domain/relation/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerRelationCommands(program: Command): void {
  const relation = program.command("relation").description("关系管理");
  relation.helpOption("-h, --help", "查看帮助");
  relation.addHelpCommand("help [command]", "查看命令帮助");

  relation
    .command("create")
    .description("创建关系")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--sourceType <type>", "起点实体类型")
    .requiredOption("--sourceId <id>", "起点实体 ID")
    .requiredOption("--targetType <type>", "终点实体类型")
    .requiredOption("--targetId <id>", "终点实体 ID")
    .requiredOption("--relationType <type>", "关系类型")
    .option("--intensity <number>", "关系强度，建议 0-100")
    .option("--status <status>", "状态", "active")
    .option("--description <text>", "描述")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("relation.create", async (logger) => {
        const result = await new RelationService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          sourceType: options.sourceType as string,
          sourceId: parseRequiredNumber(options.sourceId as string, "sourceId"),
          targetType: options.targetType as string,
          targetId: parseRequiredNumber(options.targetId as string, "targetId"),
          relationType: options.relationType as string,
          intensity: parseOptionalNumber(options.intensity as string | undefined, "intensity"),
          status: parseOptionalText(options.status as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("list")
    .description("查看某本书的关系列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("relation.list", async (logger) => {
        const result = await new RelationService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("get")
    .description("按 ID 查看关系")
    .requiredOption("--id <id>", "关系 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("relation.get", async (logger) => {
        const result = await new RelationService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("update")
    .description("更新关系")
    .requiredOption("--id <id>", "关系 ID")
    .option("--book <id>", "书籍 ID")
    .option("--sourceType <type>", "起点实体类型")
    .option("--sourceId <id>", "起点实体 ID")
    .option("--targetType <type>", "终点实体类型")
    .option("--targetId <id>", "终点实体 ID")
    .option("--relationType <type>", "关系类型")
    .option("--intensity <number>", "关系强度，建议 0-100")
    .option("--status <status>", "状态")
    .option("--description <text>", "描述")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("relation.update", async (logger) => {
        const result = await new RelationService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          sourceType: parseOptionalText(options.sourceType as string | undefined) ?? undefined,
          sourceId: options.sourceId
            ? parseRequiredNumber(options.sourceId as string, "sourceId")
            : undefined,
          targetType: parseOptionalText(options.targetType as string | undefined) ?? undefined,
          targetId: options.targetId
            ? parseRequiredNumber(options.targetId as string, "targetId")
            : undefined,
          relationType: parseOptionalText(options.relationType as string | undefined) ?? undefined,
          intensity: parseOptionalNumber(options.intensity as string | undefined, "intensity"),
          status: parseOptionalText(options.status as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("delete")
    .description("删除关系")
    .requiredOption("--id <id>", "关系 ID")
    .action(async (options) => {
      await runCliCommand("relation.delete", async (logger) => {
        await new RelationService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted relation ${options.id}`);
      });
    });
}
