import { Command } from "commander";

import { OutlineService } from "../../domain/outline/service.js";
import { printData } from "../../shared/utils/output.js";
import { parseOptionalNumber, parseOptionalText, parseRequiredNumber } from "../../shared/utils/cli.js";
import { runCliCommand } from "../runtime.js";

export function registerOutlineCommands(program: Command): void {
  const outline = program.command("outline").description("Manage outlines");

  outline
    .command("create")
    .description("Create an outline")
    .requiredOption("--book <id>", "Book id")
    .requiredOption("--title <title>", "Outline title")
    .option("--volumeNo <number>", "Volume number")
    .option("--volumeTitle <title>", "Volume title")
    .option("--chapterStart <number>", "Start chapter number")
    .option("--chapterEnd <number>", "End chapter number")
    .option("--level <level>", "Outline level", "chapter_arc")
    .option("--storyCore <text>", "Story core")
    .option("--mainPlot <text>", "Main plot")
    .option("--subPlot <text>", "Sub plot")
    .option("--foreshadowing <text>", "Foreshadowing")
    .option("--expectedPayoff <text>", "Expected payoff")
    .option("--notes <text>", "Notes")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("outline.create", async (logger) => {
        const result = await new OutlineService(logger).create({
          bookId: parseRequiredNumber(options.book as string, "book"),
          title: options.title as string,
          volumeNo: parseOptionalNumber(options.volumeNo as string | undefined, "volumeNo"),
          volumeTitle: parseOptionalText(options.volumeTitle as string | undefined),
          chapterStartNo: parseOptionalNumber(options.chapterStart as string | undefined, "chapterStart"),
          chapterEndNo: parseOptionalNumber(options.chapterEnd as string | undefined, "chapterEnd"),
          outlineLevel: options.level as string,
          storyCore: parseOptionalText(options.storyCore as string | undefined),
          mainPlot: parseOptionalText(options.mainPlot as string | undefined),
          subPlot: parseOptionalText(options.subPlot as string | undefined),
          foreshadowing: parseOptionalText(options.foreshadowing as string | undefined),
          expectedPayoff: parseOptionalText(options.expectedPayoff as string | undefined),
          notes: parseOptionalText(options.notes as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("list")
    .description("List outlines by book")
    .requiredOption("--book <id>", "Book id")
    .option("--limit <count>", "Limit result count", "50")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("outline.list", async (logger) => {
        const result = await new OutlineService(logger).list(
          parseRequiredNumber(options.book as string, "book"),
          parseRequiredNumber(options.limit as string, "limit"),
        );
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("get")
    .description("Get outline by id")
    .requiredOption("--id <id>", "Outline id")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("outline.get", async (logger) => {
        const result = await new OutlineService(logger).get(
          parseRequiredNumber(options.id as string, "id"),
        );
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("update")
    .description("Update outline by id")
    .requiredOption("--id <id>", "Outline id")
    .option("--book <id>", "Book id")
    .option("--title <title>", "Outline title")
    .option("--volumeNo <number>", "Volume number")
    .option("--volumeTitle <title>", "Volume title")
    .option("--chapterStart <number>", "Start chapter number")
    .option("--chapterEnd <number>", "End chapter number")
    .option("--level <level>", "Outline level")
    .option("--storyCore <text>", "Story core")
    .option("--mainPlot <text>", "Main plot")
    .option("--subPlot <text>", "Sub plot")
    .option("--foreshadowing <text>", "Foreshadowing")
    .option("--expectedPayoff <text>", "Expected payoff")
    .option("--notes <text>", "Notes")
    .option("--json", "Print JSON output")
    .action(async (options) => {
      await runCliCommand("outline.update", async (logger) => {
        const result = await new OutlineService(logger).update({
          id: parseRequiredNumber(options.id as string, "id"),
          bookId: options.book ? parseRequiredNumber(options.book as string, "book") : undefined,
          title: parseOptionalText(options.title as string | undefined) ?? undefined,
          volumeNo: parseOptionalNumber(options.volumeNo as string | undefined, "volumeNo"),
          volumeTitle: parseOptionalText(options.volumeTitle as string | undefined),
          chapterStartNo: parseOptionalNumber(options.chapterStart as string | undefined, "chapterStart"),
          chapterEndNo: parseOptionalNumber(options.chapterEnd as string | undefined, "chapterEnd"),
          outlineLevel: parseOptionalText(options.level as string | undefined) ?? undefined,
          storyCore: parseOptionalText(options.storyCore as string | undefined),
          mainPlot: parseOptionalText(options.mainPlot as string | undefined),
          subPlot: parseOptionalText(options.subPlot as string | undefined),
          foreshadowing: parseOptionalText(options.foreshadowing as string | undefined),
          expectedPayoff: parseOptionalText(options.expectedPayoff as string | undefined),
          notes: parseOptionalText(options.notes as string | undefined),
        });
        printData(result, Boolean(options.json));
      });
    });

  outline
    .command("delete")
    .description("Delete outline by id")
    .requiredOption("--id <id>", "Outline id")
    .action(async (options) => {
      await runCliCommand("outline.delete", async (logger) => {
        await new OutlineService(logger).remove(parseRequiredNumber(options.id as string, "id"));
        printData(`Deleted outline ${options.id}`);
      });
    });
}
