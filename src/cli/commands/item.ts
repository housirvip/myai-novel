import { Command } from "commander";

import { ItemService } from "../../domain/item/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerItemCommands(program: Command): void {
  const item = program.command("item").description("Manage items");

  item
    .command("create")
    .description("Create an item")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--name <name>", "Item name")
    .option("--category <category>", "Category")
    .option("--description <text>", "Description")
    .option("--ownerType <type>", "Owner type", "none")
    .option("--ownerId <id>", "Owner id")
    .option("--rarity <rarity>", "Rarity")
    .option("--status <status>", "Status", "active")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("item.create", async (logger) => {
        const result = await new ItemService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          category: parseOptionalText(options.category as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          ownerType: options.ownerType as string,
          ownerId: parseOptionalNumber(options.ownerId as string | undefined, "ownerId"),
          rarity: parseOptionalText(options.rarity as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("list")
    .description("List items by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("item.list", async (logger) => {
        const result = await new ItemService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("get")
    .description("Get item by id")
    .requiredOption("--id <id>", "Item id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("item.get", async (logger) => {
        const result = await new ItemService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("update")
    .description("Update item by id")
    .requiredOption("--id <id>", "Item id")
    .option("--book <id>", "Book id")
    .option("--name <name>", "Item name")
    .option("--category <category>", "Category")
    .option("--description <text>", "Description")
    .option("--ownerType <type>", "Owner type")
    .option("--ownerId <id>", "Owner id")
    .option("--rarity <rarity>", "Rarity")
    .option("--status <status>", "Status")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("item.update", async (logger) => {
        const result = await new ItemService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          ownerType: parseOptionalText(options.ownerType as string | undefined) ?? undefined,
          ownerId: parseOptionalNumber(options.ownerId as string | undefined, "ownerId"),
          rarity: parseOptionalText(options.rarity as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  item
    .command("delete")
    .description("Delete item by id")
    .requiredOption("--id <id>", "Item id")
    .action(async (options) => {
      await runCliCommand("item.delete", async (logger) => {
        await new ItemService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted item ${options.id}`);
      });
    });
}
