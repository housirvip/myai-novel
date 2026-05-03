import { Command } from "commander";

import { ApproveChapterWorkflow } from "../../domain/workflows/approve-chapter-workflow.js";
import { parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerApproveCommands(program: Command): void {
  program
    .command("approve")
    .description("将当前草稿定稿，并把事实同步回设定库")
    .requiredOption("--book <id>", "书籍 ID")
    .requiredOption("--chapter <number>", "章节号")
    .option("--provider <provider>", "覆盖默认 LLM provider")
    .option("--model <model>", "覆盖当前模型选择结果（优先于档位路由和 provider 默认模型）")
    .option("--dryRun", "仅生成正式稿和 diff，不写入数据库")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("approve", async (logger) => {
        // dryRun 标志会原样传给 workflow，
        // 用来区分这次 approve 是正式提交还是仅做预演检查。
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
