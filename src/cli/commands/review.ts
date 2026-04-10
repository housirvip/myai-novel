import { Command } from "commander";

import { ReviewChapterWorkflow } from "../../domain/workflows/review-chapter-workflow.js";
import { parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerReviewCommands(program: Command): void {
  program
    .command("review")
    .description("Review current chapter draft")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--provider <provider>", "LLM provider override")
    .option("--model <model>", "LLM model override")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("review", async (logger) => {
        const result = await new ReviewChapterWorkflow(logger).run({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
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
