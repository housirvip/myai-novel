import { Command } from "commander";

import { RelationService } from "../../domain/relation/service.js";
import {
  parseOptionalKeywordsText,
  parseOptionalNumber,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerRelationCommands(program: Command): void {
  const relation = program.command("relation").description("Manage relations");

  relation
    .command("create")
    .description("Create a relation")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--sourceType <type>", "Source type")
    .requiredOption("--sourceId <id>", "Source id")
    .requiredOption("--targetType <type>", "Target type")
    .requiredOption("--targetId <id>", "Target id")
    .requiredOption("--relationType <type>", "Relation type")
    .option("--intensity <number>", "Intensity 0-100")
    .option("--status <status>", "Status", "active")
    .option("--description <text>", "Description")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("relation.create", async (logger) => {
        const result = await new RelationService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          sourceType: options.sourceType as string,
          sourceId: parseRequiredNumber(options.sourceId as string, "sourceId"),
          targetType: options.targetType as string,
          targetId: parseRequiredNumber(options.targetId as string, "targetId"),
          relationType: options.relationType as string,
          intensity: parseOptionalNumber(options.intensity as string | undefined, "intensity"),
          status: parseOptionalText(options.status as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("list")
    .description("List relations by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("relation.list", async (logger) => {
        const result = await new RelationService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("get")
    .description("Get relation by id")
    .requiredOption("--id <id>", "Relation id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("relation.get", async (logger) => {
        const result = await new RelationService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("update")
    .description("Update relation by id")
    .requiredOption("--id <id>", "Relation id")
    .option("--book <id>", "Book id")
    .option("--sourceType <type>", "Source type")
    .option("--sourceId <id>", "Source id")
    .option("--targetType <type>", "Target type")
    .option("--targetId <id>", "Target id")
    .option("--relationType <type>", "Relation type")
    .option("--intensity <number>", "Intensity 0-100")
    .option("--status <status>", "Status")
    .option("--description <text>", "Description")
    .option("--appendNotes <text>", "Append notes")
    .option("--keywords <items>", "Keywords, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("relation.update", async (logger) => {
        const result = await new RelationService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          sourceType: parseOptionalText(options.sourceType as string | undefined) ?? undefined,
          sourceId: options.sourceId
            ? parseRequiredNumber(options.sourceId as string, "sourceId")
            : undefined,
          targetType: parseOptionalText(options.targetType as string | undefined) ?? undefined,
          targetId: options.targetId
            ? parseRequiredNumber(options.targetId as string, "targetId")
            : undefined,
          relationType: parseOptionalText(options.relationType as string | undefined) ?? undefined,
          intensity: parseOptionalNumber(options.intensity as string | undefined, "intensity"),
          status: parseOptionalText(options.status as string | undefined),
          description: parseOptionalText(options.description as string | undefined),
          appendNotes: parseOptionalText(options.appendNotes as string | undefined),
          keywords: parseOptionalKeywordsText(options.keywords as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  relation
    .command("delete")
    .description("Delete relation by id")
    .requiredOption("--id <id>", "Relation id")
    .action(async (options) => {
      await runCliCommand("relation.delete", async (logger) => {
        await new RelationService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted relation ${options.id}`);
      });
    });
}
