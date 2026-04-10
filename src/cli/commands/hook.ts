import { Command } from "commander";

import { StoryHookService } from "../../domain/story-hook/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerHookCommands(program: Command): void {
  const hook = program.command("hook").description("Manage story hooks");

  hook
    .command("create")
    .description("Create a story hook")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--title <title>", "Story hook title")
    .option("--hookType <type>", "Hook type")
    .option("--description <text>", "Description")
    .option("--sourceChapter <number>", "Source chapter number")
    .option("--targetChapter <number>", "Target chapter number")
    .option("--status <status>", "Status", "open")
    .option("--importance <level>", "Importance")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("hook.create", async (logger) => {
        const result = await new StoryHookService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          hookType: parseOptionalText(options.hookType as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          sourceChapterNo: parseOptionalNumber(options.sourceChapter as string | undefined, "sourceChapter"),
          targetChapterNo: parseOptionalNumber(options.targetChapter as string | undefined, "targetChapter"),
          status: options.status as string,
          importance: parseOptionalText(options.importance as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("list")
    .description("List story hooks by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("hook.list", async (logger) => {
        const result = await new StoryHookService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("get")
    .description("Get story hook by id")
    .requiredOption("--id <id>", "Story hook id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("hook.get", async (logger) => {
        const result = await new StoryHookService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("update")
    .description("Update story hook by id")
    .requiredOption("--id <id>", "Story hook id")
    .option("--book <id>", "Book id")
    .option("--title <title>", "Story hook title")
    .option("--hookType <type>", "Hook type")
    .option("--description <text>", "Description")
    .option("--sourceChapter <number>", "Source chapter number")
    .option("--targetChapter <number>", "Target chapter number")
    .option("--status <status>", "Status")
    .option("--importance <level>", "Importance")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("hook.update", async (logger) => {
        const result = await new StoryHookService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          hookType: parseOptionalText(options.hookType as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          sourceChapterNo: parseOptionalNumber(options.sourceChapter as string | undefined, "sourceChapter"),
          targetChapterNo: parseOptionalNumber(options.targetChapter as string | undefined, "targetChapter"),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          importance: parseOptionalText(options.importance as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  hook
    .command("delete")
    .description("Delete story hook by id")
    .requiredOption("--id <id>", "Story hook id")
    .action(async (options) => {
      await runCliCommand("hook.delete", async (logger) => {
        await new StoryHookService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted story hook ${options.id}`);
      });
    });
}
