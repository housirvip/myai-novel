import { Command } from "commander";

import { DraftChapterWorkflow } from "../../domain/workflows/draft-chapter-workflow.js";
import { parseOptionalNumber, parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerDraftCommands(program: Command): void {
  program
    .command("draft")
    .description("Generate draft content for a chapter")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--provider <provider>", "LLM provider override")
    .option("--model <model>", "LLM model override")
    .option("--targetWords <number>", "Target word count")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("draft", async (logger) => {
        const result = await new DraftChapterWorkflow(logger).run({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          provider: parseOptionalText(options.provider as string | undefined) as
            | "mock"
            | "openai"
            | "anthropic"
            | "custom"
            | undefined,
          model: parseOptionalText(options.model as string | undefined) ?? undefined,
          targetWords:
            parseOptionalNumber(options.targetWords as string | undefined, "targetWords") ?? undefined,
        });

        printData(result, Boolean(options.json));
      });
    });
}
