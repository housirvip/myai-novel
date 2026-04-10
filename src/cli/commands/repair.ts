import { Command } from "commander";

import { RepairChapterWorkflow } from "../../domain/workflows/repair-chapter-workflow.js";
import { parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerRepairCommands(program: Command): void {
  program
    .command("repair")
    .description("根据当前审阅结果修复章节草稿")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--provider <provider>", "覆盖默认 LLM provider")
    .option("--model <model>", "覆盖默认模型")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("repair", async (logger) => {
        const result = await new RepairChapterWorkflow(logger).run({
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
