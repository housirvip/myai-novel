import { Command } from "commander";

import { CharacterService } from "../../domain/character/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalStructuredText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerCharacterCommands(program: Command): void {
  const character = program.command("character").description("Manage characters");

  character
    .command("create")
    .description("Create a character")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--name <name>", "Character name")
    .option("--alias <alias>", "Alias")
    .option("--gender <gender>", "Gender")
    .option("--age <age>", "Age")
    .option("--personality <text>", "Personality")
    .option("--background <text>", "Background")
    .option("--location <text>", "Current location")
    .option("--status <status>", "Status", "alive")
    .option("--professions <items>", "Professions, JSON or comma separated")
    .option("--levels <items>", "Levels, JSON or comma separated")
    .option("--currencies <items>", "Currencies, JSON or comma separated")
    .option("--abilities <items>", "Abilities, JSON or comma separated")
    .option("--goal <text>", "Goal")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("character.create", async (logger) => {
        const result = await new CharacterService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          name: options.name as string,
          alias: parseOptionalText(options.alias as string | undefined),
          gender: parseOptionalText(options.gender as string | undefined),
          age: parseOptionalNumber(options.age as string | undefined, "age"),
          personality: parseOptionalText(options.personality as string | undefined),
          background: parseOptionalText(options.background as string | undefined),
          currentLocation: parseOptionalText(options.location as string | undefined),
          status: options.status as string,
          professions: parseOptionalStructuredText(options.professions as string | undefined, "professions"),
          levels: parseOptionalStructuredText(options.levels as string | undefined, "levels"),
          currencies: parseOptionalStructuredText(options.currencies as string | undefined, "currencies"),
          abilities: parseOptionalStructuredText(options.abilities as string | undefined, "abilities"),
          goal: parseOptionalText(options.goal as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("list")
    .description("List characters by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("character.list", async (logger) => {
        const result = await new CharacterService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("get")
    .description("Get character by id")
    .requiredOption("--id <id>", "Character id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("character.get", async (logger) => {
        const result = await new CharacterService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("update")
    .description("Update character by id")
    .requiredOption("--id <id>", "Character id")
    .option("--book <id>", "Book id")
    .option("--name <name>", "Character name")
    .option("--alias <alias>", "Alias")
    .option("--gender <gender>", "Gender")
    .option("--age <age>", "Age")
    .option("--personality <text>", "Personality")
    .option("--background <text>", "Background")
    .option("--location <text>", "Current location")
    .option("--status <status>", "Status")
    .option("--professions <items>", "Professions, JSON or comma separated")
    .option("--levels <items>", "Levels, JSON or comma separated")
    .option("--currencies <items>", "Currencies, JSON or comma separated")
    .option("--abilities <items>", "Abilities, JSON or comma separated")
    .option("--goal <text>", "Goal")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("character.update", async (logger) => {
        const result = await new CharacterService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          name: parseOptionalText(options.name as string | undefined) ?? undefined,
          alias: parseOptionalText(options.alias as string | undefined),
          gender: parseOptionalText(options.gender as string | undefined),
          age: parseOptionalNumber(options.age as string | undefined, "age"),
          personality: parseOptionalText(options.personality as string | undefined),
          background: parseOptionalText(options.background as string | undefined),
          currentLocation: parseOptionalText(options.location as string | undefined),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          professions: parseOptionalStructuredText(options.professions as string | undefined, "professions"),
          levels: parseOptionalStructuredText(options.levels as string | undefined, "levels"),
          currencies: parseOptionalStructuredText(options.currencies as string | undefined, "currencies"),
          abilities: parseOptionalStructuredText(options.abilities as string | undefined, "abilities"),
          goal: parseOptionalText(options.goal as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  character
    .command("delete")
    .description("Delete character by id")
    .requiredOption("--id <id>", "Character id")
    .action(async (options) => {
      await runCliCommand("character.delete", async (logger) => {
        await new CharacterService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted character ${options.id}`);
      });
    });
}
