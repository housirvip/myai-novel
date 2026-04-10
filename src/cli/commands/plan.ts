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
    .description("Generate chapter plan with retrieved context")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--authorIntent <text>", "Author intent for this chapter")
    .option("--characterIds <ids>", "Related character ids, JSON array or comma separated")
    .option("--factionIds <ids>", "Related faction ids, JSON array or comma separated")
    .option("--itemIds <ids>", "Related item ids, JSON array or comma separated")
    .option("--hookIds <ids>", "Related hook ids, JSON array or comma separated")
    .option("--relationIds <ids>", "Related relation ids, JSON array or comma separated")
    .option("--worldSettingIds <ids>", "Related world setting ids, JSON array or comma separated")
    .option("--provider <provider>", "LLM provider override")
    .option("--model <model>", "LLM model override")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("plan", async (logger) => {
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
