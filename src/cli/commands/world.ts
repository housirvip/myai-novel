import { Command } from "commander";

import { WorldSettingService } from "../../domain/world-setting/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerWorldCommands(program: Command): void {
  const world = program.command("world").description("Manage world settings");

  world
    .command("create")
    .description("Create a world setting")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--title <title>", "World setting title")
    .requiredOption("--category <category>", "World setting category")
    .requiredOption("--content <content>", "World setting content")
    .option("--status <status>", "Status", "active")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("world.create", async (logger) => {
        const result = await new WorldSettingService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          category: options.category as string,
          content: options.content as string,
          status: options.status as string,
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("list")
    .description("List world settings by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("world.list", async (logger) => {
        const result = await new WorldSettingService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("get")
    .description("Get world setting by id")
    .requiredOption("--id <id>", "World setting id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("world.get", async (logger) => {
        const result = await new WorldSettingService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("update")
    .description("Update world setting by id")
    .requiredOption("--id <id>", "World setting id")
    .option("--book <id>", "Book id")
    .option("--title <title>", "World setting title")
    .option("--category <category>", "World setting category")
    .option("--content <content>", "World setting content")
    .option("--status <status>", "Status")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("world.update", async (logger) => {
        const result = await new WorldSettingService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined) ?? undefined,
          content: parseOptionalText(options.content as string | undefined) ?? undefined,
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  world
    .command("delete")
    .description("Delete world setting by id")
    .requiredOption("--id <id>", "World setting id")
    .action(async (options) => {
      await runCliCommand("world.delete", async (logger) => {
        await new WorldSettingService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted world setting ${options.id}`);
      });
    });
}
