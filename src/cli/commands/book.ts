import { Command } from "commander";

import { BookService } from "../../domain/book/service.js";
import { runCliCommand } from "../runtime.js";
import { printData } from "../../shared/utils/output.js";

export function registerBookCommands(program: Command): void {
  const book = program.command("book").description("Manage books");

  book
    .command("create")
    .description("Create a book")
    .requiredOption("--title <title>", "Book title")
    .option("--summary <summary>", "Book summary")
    .option("--targetChapters <count>", "Target chapter count")
    .option("--status <status>", "Book status", "planning")
    .option("--json", "Print JSON output")
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
    .description("List books")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("book.list", async (logger) => {
        const service = new BookService(logger);
        const result = await service.list(Number(options.limit));
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("get")
    .description("Get a book by id")
    .requiredOption("--id <id>", "Book id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("book.get", async (logger) => {
        const service = new BookService(logger);
        const result = await service.get(Number(options.id));
        printData(result, Boolean(options.json));
      });
    });

  book
    .command("update")
    .description("Update a book")
    .requiredOption("--id <id>", "Book id")
    .option("--title <title>", "Book title")
    .option("--summary <summary>", "Book summary")
    .option("--targetChapters <count>", "Target chapter count")
    .option("--status <status>", "Book status")
    .option("--json", "Print JSON output")
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
    .description("Delete a book")
    .requiredOption("--id <id>", "Book id")
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
