import { Command } from "commander";

import { parseIdList } from "../../domain/planning/input.js";
import {
  createEmptyManualEntityRefs,
  PlanChapterWorkflow,
} from "../../domain/workflows/plan-chapter-workflow.js";
import { printData } from "../../shared/utils/output.js";
import { parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { runCliCommand } from "../runtime.js";

export function registerPlanCommands(program: Command): void {
  program
    .command("plan")
    .description("规划本章内容并召回相关设定")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--authorIntent <text>", "作者对本章的意图")
    .option("--characterIds <ids>", "关联人物 ID，支持 JSON 数组或逗号分隔")
    .option("--factionIds <ids>", "关联势力 ID，支持 JSON 数组或逗号分隔")
    .option("--itemIds <ids>", "关联物品 ID，支持 JSON 数组或逗号分隔")
    .option("--hookIds <ids>", "关联钩子 ID，支持 JSON 数组或逗号分隔")
    .option("--relationIds <ids>", "关联关系 ID，支持 JSON 数组或逗号分隔")
    .option("--worldSettingIds <ids>", "关联世界设定 ID，支持 JSON 数组或逗号分隔")
    .option("--provider <provider>", "覆盖默认 LLM provider")
    .option("--model <model>", "覆盖当前模型选择结果（优先于档位路由和 provider 默认模型）")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("plan", async (logger) => {
        // 这些手工引用会作为显式实体锚点传给 workflow，
        // 用来表达“这些实体和本章意图强相关”，而不是替代普通参数输入。
        const manualEntityRefs = createEmptyManualEntityRefs();

        manualEntityRefs.characterIds = parseIdList(
          options.characterIds as string | undefined,
          "characterIds",
        );
        manualEntityRefs.factionIds = parseIdList(
          options.factionIds as string | undefined,
          "factionIds",
        );
        manualEntityRefs.itemIds = parseIdList(options.itemIds as string | undefined, "itemIds");
        manualEntityRefs.hookIds = parseIdList(options.hookIds as string | undefined, "hookIds");
        manualEntityRefs.relationIds = parseIdList(
          options.relationIds as string | undefined,
          "relationIds",
        );
        manualEntityRefs.worldSettingIds = parseIdList(
          options.worldSettingIds as string | undefined,
          "worldSettingIds",
        );

        const result = await new PlanChapterWorkflow(logger).run({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          authorIntent: parseOptionalText(options.authorIntent as string | undefined) ?? undefined,
          manualEntityRefs,
          provider: parseOptionalText(options.provider as string | undefined) as
            | "mock"
            | "openai"
            | "anthropic"
            | "custom"
            | undefined,
          model: parseOptionalText(options.model as string | undefined) ?? undefined,
        });

        printData(result, Boolean(options.json));
      });
    });
}
