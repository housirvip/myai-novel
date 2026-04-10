import { Command } from "commander";

import { DraftChapterWorkflow } from "../../domain/workflows/draft-chapter-workflow.js";
import { parseOptionalNumber, parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerDraftCommands(program: Command): void {
  program
    .command("draft")
    .description("根据当前 plan 生成章节草稿")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--provider <provider>", "覆盖默认 LLM provider")
    .option("--model <model>", "覆盖默认模型")
    .option("--targetWords <number>", "目标字数")
    .option("--json", "以 JSON 输出结果")
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
