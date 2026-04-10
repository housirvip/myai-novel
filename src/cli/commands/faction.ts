import { Command } from "commander";

import { FactionService } from "../../domain/faction/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerFactionCommands(program: Command): void {
  const faction = program.command("faction").description("Manage factions");

  faction
    .command("create")
    .description("Create a faction")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--name <name>", "Faction name")
    .option("--category <category>", "Category")
    .option("--coreGoal <text>", "Core goal")
    .option("--description <text>", "Description")
    .option("--leaderCharacterId <id>", "Leader character id")
    .option("--headquarter <text>", "Headquarter")
    .option("--status <status>", "Status", "active")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("faction.create", async (logger) => {
        const result = await new FactionService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          category: parseOptionalText(options.category as string | undefined),
          coreGoal: parseOptionalText(options.coreGoal as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          leaderCharacterId: parseOptionalNumber(
            options.leaderCharacterId as string | undefined,
            "leaderCharacterId",
          ),
          headquarter: parseOptionalText(options.headquarter as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("list")
    .description("List factions by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("faction.list", async (logger) => {
        const result = await new FactionService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("get")
    .description("Get faction by id")
    .requiredOption("--id <id>", "Faction id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("faction.get", async (logger) => {
        const result = await new FactionService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("update")
    .description("Update faction by id")
    .requiredOption("--id <id>", "Faction id")
    .option("--book <id>", "Book id")
    .option("--name <name>", "Faction name")
    .option("--category <category>", "Category")
    .option("--coreGoal <text>", "Core goal")
    .option("--description <text>", "Description")
    .option("--leaderCharacterId <id>", "Leader character id")
    .option("--headquarter <text>", "Headquarter")
    .option("--status <status>", "Status")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("faction.update", async (logger) => {
        const result = await new FactionService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          category: parseOptionalText(options.category as string | undefined),
          coreGoal: parseOptionalText(options.coreGoal as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          leaderCharacterId: parseOptionalNumber(
            options.leaderCharacterId as string | undefined,
            "leaderCharacterId",
          ),
          headquarter: parseOptionalText(options.headquarter as string | undefined),
          status: parseOptionalText(options.status as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  faction
    .command("delete")
    .description("Delete faction by id")
    .requiredOption("--id <id>", "Faction id")
    .action(async (options) => {
      await runCliCommand("faction.delete", async (logger) => {
        await new FactionService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted faction ${options.id}`);
      });
    });
}
