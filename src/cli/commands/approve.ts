import { Command } from "commander";

import { ApproveChapterWorkflow } from "../../domain/workflows/approve-chapter-workflow.js";
import { parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerApproveCommands(program: Command): void {
  program
    .command("approve")
    .description("Approve current chapter draft into final content and sync facts")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--provider <provider>", "LLM provider override")
    .option("--model <model>", "LLM model override")
    .option("--dryRun", "Generate final content and diff without writing to database")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("approve", async (logger) => {
        const result = await new ApproveChapterWorkflow(logger).run({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          provider: parseOptionalText(options.provider as string | undefined) as
            | "mock"
            | "openai"
            | "anthropic"
            | "custom"
            | undefined,
          model: parseOptionalText(options.model as string | undefined) ?? undefined,
          dryRun: Boolean(options.dryRun),
        });

        printData(result, Boolean(options.json));
      });
    });
}
