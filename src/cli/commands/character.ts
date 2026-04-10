import { Command } from "commander";

import { CharacterService } from "../../domain/character/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalStructuredText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerCharacterCommands(program: Command): void {
  const character = program.command("character").description("人物管理");
  character.helpOption("-h, --help", "查看帮助");
  character.addHelpCommand("help [command]", "查看命令帮助");

  character
    .command("create")
    .description("创建人物")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--name <name>", "人物名称")
    .option("--alias <alias>", "别名")
    .option("--gender <gender>", "性别")
    .option("--age <age>", "年龄")
    .option("--personality <text>", "性格")
    .option("--background <text>", "背景")
    .option("--location <text>", "当前位置")
    .option("--status <status>", "状态", "alive")
    .option("--professions <items>", "职业，支持 JSON 或逗号分隔")
    .option("--levels <items>", "等级/境界，支持 JSON 或逗号分隔")
    .option("--currencies <items>", "货币，支持 JSON 或逗号分隔")
    .option("--abilities <items>", "特殊能力，支持 JSON 或逗号分隔")
    .option("--goal <text>", "目标")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("character.create", async (logger) => {
        const result = await new CharacterService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          alias: parseOptionalText(options.alias as string | undefined),
          gender: parseOptionalText(options.gender as string | undefined),
          age: parseOptionalNumber(options.age as string | undefined, "age"),
          personality: parseOptionalText(options.personality as string | undefined),
          background: parseOptionalText(options.background as string | undefined),
          currentLocation: parseOptionalText(options.location as string | undefined),
          status: options.status as string,
          professions: parseOptionalStructuredText(options.professions as string | undefined, "professions"),
          levels: parseOptionalStructuredText(options.levels as string | undefined, "levels"),
          currencies: parseOptionalStructuredText(options.currencies as string | undefined, "currencies"),
          abilities: parseOptionalStructuredText(options.abilities as string | undefined, "abilities"),
          goal: parseOptionalText(options.goal as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("list")
    .description("查看某本书的人物列表")
    .requiredOption("--book <id>", "书籍 ID")
    .option("--status <status>", "按状态过滤")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("character.list", async (logger) => {
        const result = await new CharacterService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("get")
    .description("按 ID 查看人物")
    .requiredOption("--id <id>", "人物 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("character.get", async (logger) => {
        const result = await new CharacterService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("update")
    .description("更新人物")
    .requiredOption("--id <id>", "人物 ID")
    .option("--book <id>", "书籍 ID")
    .option("--name <name>", "人物名称")
    .option("--alias <alias>", "别名")
    .option("--gender <gender>", "性别")
    .option("--age <age>", "年龄")
    .option("--personality <text>", "性格")
    .option("--background <text>", "背景")
    .option("--location <text>", "当前位置")
    .option("--status <status>", "状态")
    .option("--professions <items>", "职业，支持 JSON 或逗号分隔")
    .option("--levels <items>", "等级/境界，支持 JSON 或逗号分隔")
    .option("--currencies <items>", "货币，支持 JSON 或逗号分隔")
    .option("--abilities <items>", "特殊能力，支持 JSON 或逗号分隔")
    .option("--goal <text>", "目标")
    .option("--appendNotes <text>", "补充信息")
    .option("--keywords <items>", "关键词，支持 JSON 数组或逗号分隔")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("character.update", async (logger) => {
        const result = await new CharacterService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          alias: parseOptionalText(options.alias as string | undefined),
          gender: parseOptionalText(options.gender as string | undefined),
          age: parseOptionalNumber(options.age as string | undefined, "age"),
          personality: parseOptionalText(options.personality as string | undefined),
          background: parseOptionalText(options.background as string | undefined),
          currentLocation: parseOptionalText(options.location as string | undefined),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          professions: parseOptionalStructuredText(options.professions as string | undefined, "professions"),
          levels: parseOptionalStructuredText(options.levels as string | undefined, "levels"),
          currencies: parseOptionalStructuredText(options.currencies as string | undefined, "currencies"),
          abilities: parseOptionalStructuredText(options.abilities as string | undefined, "abilities"),
          goal: parseOptionalText(options.goal as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("delete")
    .description("删除人物")
    .requiredOption("--id <id>", "人物 ID")
    .action(async (options) => {
      await runCliCommand("character.delete", async (logger) => {
        await new CharacterService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted character ${options.id}`);
      });
    });
}
