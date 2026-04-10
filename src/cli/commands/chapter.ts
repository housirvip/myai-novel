import { Command } from "commander";

import { ChapterService } from "../../domain/chapter/service.js";
import {
  parseOptionalNumber,
  parseOptionalNumberArrayText,
  parseOptionalText,
  parseRequiredNumber,
} from "../../shared/utils/cli.js";
import { printData } from "../../shared/utils/output.js";
import { runCliCommand } from "../runtime.js";

export function registerChapterCommands(program: Command): void {
  const chapter = program.command("chapter").description("Manage chapters");

  chapter
    .command("create")
    .description("Create a chapter")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--title <title>", "Chapter title")
    .option("--summary <text>", "Summary")
    .option("--wordCount <number>", "Word count")
    .option("--status <status>", "Status", "todo")
    .option("--characterIds <ids>", "Actual character ids, JSON array or comma separated")
    .option("--factionIds <ids>", "Actual faction ids, JSON array or comma separated")
    .option("--itemIds <ids>", "Actual item ids, JSON array or comma separated")
    .option("--hookIds <ids>", "Actual hook ids, JSON array or comma separated")
    .option("--worldSettingIds <ids>", "Actual world setting ids, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.create", async (logger) => {
        const result = await new ChapterService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          title: parseOptionalText(options.title as string | undefined),
          summary: parseOptionalText(options.summary as string | undefined),
          wordCount: parseOptionalNumber(options.wordCount as string | undefined, "wordCount"),
          status: options.status as string,
          actualCharacterIds: parseOptionalNumberArrayText(
            options.characterIds as string | undefined,
            "characterIds",
          ),
          actualFactionIds: parseOptionalNumberArrayText(
            options.factionIds as string | undefined,
            "factionIds",
          ),
          actualItemIds: parseOptionalNumberArrayText(options.itemIds as string | undefined, "itemIds"),
          actualHookIds: parseOptionalNumberArrayText(options.hookIds as string | undefined, "hookIds"),
          actualWorldSettingIds: parseOptionalNumberArrayText(
            options.worldSettingIds as string | undefined,
            "worldSettingIds",
          ),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("list")
    .description("List chapters by book")
    .requiredOption("--book <id>", "Book id")
    .option("--status <status>", "Filter by status")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.list", async (logger) => {
        const result = await new ChapterService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
          options.status as string | undefined,
        );
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("get")
    .description("Get chapter by book and chapter number")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.get", async (logger) => {
        const result = await new ChapterService(logger).get(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.chapter as string, "chapter"),
        );
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("update")
    .description("Update chapter by book and chapter number")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .option("--title <title>", "Chapter title")
    .option("--summary <text>", "Summary")
    .option("--wordCount <number>", "Word count")
    .option("--status <status>", "Status")
    .option("--characterIds <ids>", "Actual character ids, JSON array or comma separated")
    .option("--factionIds <ids>", "Actual faction ids, JSON array or comma separated")
    .option("--itemIds <ids>", "Actual item ids, JSON array or comma separated")
    .option("--hookIds <ids>", "Actual hook ids, JSON array or comma separated")
    .option("--worldSettingIds <ids>", "Actual world setting ids, JSON array or comma separated")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.update", async (logger) => {
        const result = await new ChapterService(logger).update({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          title: parseOptionalText(options.title as string | undefined),
          summary: parseOptionalText(options.summary as string | undefined),
          wordCount: parseOptionalNumber(options.wordCount as string | undefined, "wordCount"),
          status: parseOptionalText(options.status as string | undefined) ?? undefined,
          actualCharacterIds: parseOptionalNumberArrayText(
            options.characterIds as string | undefined,
            "characterIds",
          ),
          actualFactionIds: parseOptionalNumberArrayText(
            options.factionIds as string | undefined,
            "factionIds",
          ),
          actualItemIds: parseOptionalNumberArrayText(options.itemIds as string | undefined, "itemIds"),
          actualHookIds: parseOptionalNumberArrayText(options.hookIds as string | undefined, "hookIds"),
          actualWorldSettingIds: parseOptionalNumberArrayText(
            options.worldSettingIds as string | undefined,
            "worldSettingIds",
          ),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("export")
    .description("Export chapter stage to markdown")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .requiredOption("--stage <stage>", "Stage: plan | draft | final")
    .requiredOption("--output <path>", "Output path")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.export", async (logger) => {
        const result = await new ChapterService(logger).exportStage({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          stage: options.stage as "plan" | "draft" | "final",
          outputPath: options.output as string,
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("import")
    .description("Import chapter stage from markdown")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .requiredOption("--stage <stage>", "Stage: plan | draft | final")
    .requiredOption("--input <path>", "Input path")
    .option("--force", "Force import even if status guard would block it")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("chapter.import", async (logger) => {
        const result = await new ChapterService(logger).importStage({
          bookId: parseRequiredNumber(options.book as string, "book"),
          chapterNo: parseRequiredNumber(options.chapter as string, "chapter"),
          stage: options.stage as "plan" | "draft" | "final",
          inputPath: options.input as string,
          force: Boolean(options.force),
        });
        printData(result, Boolean(options.json));
      });
    });

  chapter
    .command("delete")
    .description("Delete chapter by book and chapter number")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--chapter <number>", "Chapter number")
    .action(async (options) => {
      await runCliCommand("chapter.delete", async (logger) => {
        await new ChapterService(logger).remove(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.chapter as string, "chapter"),
        );
        printData(`Deleted chapter ${options.chapter} from book ${options.book}`);
      });
    });
}
