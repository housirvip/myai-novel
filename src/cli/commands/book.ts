import { Command } from "commander";

import { BookService } from "../../domain/book/service.js";
import { runCliCommand } from "../runtime.js";
import { printData } from "../../shared/utils/output.js";

export function registerBookCommands(program: Command): void {
  const book = program.command("book").description("书籍管理");
  book.helpOption("-h, --help", "查看帮助");
  book.addHelpCommand("help [command]", "查看命令帮助");

  book
    .command("create")
    .description("创建书籍")
    .requiredOption("--title <title>", "书名")
    .option("--summary <summary>", "书籍简介")
    .option("--targetChapters <count>", "预期章节数")
    .option("--status <status>", "书籍状态", "planning")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("book.create", async (logger) => {
        const service = new BookService(logger);
        const result = await service.create({
          title: options.title as string,
          summary: options.summary as string | undefined,
          targetChapterCount: parseOptionalNumber(options.targetChapters as string | undefined),
          status: options.status as string,
        });
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("list")
    .description("查看书籍列表")
    .option("--limit <count>", "返回数量上限", "50")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("book.list", async (logger) => {
        const service = new BookService(logger);
        const result = await service.list(Number(options.limit));
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("get")
    .description("按 ID 查看书籍")
    .requiredOption("--id <id>", "书籍 ID")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("book.get", async (logger) => {
        const service = new BookService(logger);
        const result = await service.get(Number(options.id));
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("update")
    .description("更新书籍")
    .requiredOption("--id <id>", "书籍 ID")
    .option("--title <title>", "书名")
    .option("--summary <summary>", "书籍简介")
    .option("--targetChapters <count>", "预期章节数")
    .option("--status <status>", "书籍状态")
    .option("--json", "以 JSON 输出结果")
    .action(async (options) => {
      await runCliCommand("book.update", async (logger) => {
        const service = new BookService(logger);
        const result = await service.update({
          id: Number(options.id),
          title: options.title as string | undefined,
          summary: options.summary as string | undefined,
          targetChapterCount: parseOptionalNumber(options.targetChapters as string | undefined),
          status: options.status as string | undefined,
        });
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("delete")
    .description("删除书籍")
    .requiredOption("--id <id>", "书籍 ID")
    .action(async (options) => {
      await runCliCommand("book.delete", async (logger) => {
        const service = new BookService(logger);
        await service.remove(Number(options.id));
        printData(`Deleted book ${options.id}`);
      });
    });
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  return Number(value);
}
