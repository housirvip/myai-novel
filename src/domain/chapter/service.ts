import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  ChapterDraftRepository,
  type ChapterDraftRow,
} from "../../core/db/repositories/chapter-draft-repository.js";
import {
  ChapterFinalRepository,
  type ChapterFinalRow,
} from "../../core/db/repositories/chapter-final-repository.js";
import { BookRepository } from "../../core/db/repositories/book-repository.js";
import {
  ChapterPlanRepository,
  type ChapterPlanRow,
} from "../../core/db/repositories/chapter-plan-repository.js";
import {
  ChapterRepository,
  type ChapterRow,
} from "../../core/db/repositories/chapter-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import {
  formatChapterMarkdown,
  parseChapterMarkdown,
  type ChapterStage,
} from "../../shared/utils/markdown.js";
import { nowIso } from "../../shared/utils/time.js";
import { estimateWordCount } from "../../shared/utils/word-count.js";
import { executeDbAction } from "../shared/service-helpers.js";
import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS, PLAN_INTENT_SOURCE } from "../shared/constants.js";

const createChapterSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  wordCount: z.number().int().positive().nullable().optional(),
  status: z.string().min(1).default(CHAPTER_STATUS.TODO),
  actualCharacterIds: z.string().nullable().optional(),
  actualFactionIds: z.string().nullable().optional(),
  actualItemIds: z.string().nullable().optional(),
  actualHookIds: z.string().nullable().optional(),
  actualWorldSettingIds: z.string().nullable().optional(),
});

const updateChapterSchema = createChapterSchema.partial().extend({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
});

const exportChapterSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  stage: z.enum(["plan", "draft", "final"]),
  outputPath: z.string().min(1),
});

const importChapterSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  stage: z.enum(["plan", "draft", "final"]),
  inputPath: z.string().min(1),
  force: z.boolean().default(false),
});

type StageArtifact =
  | { row: ChapterPlanRow; content: string; summary: string | null; wordCount: number | null }
  | { row: ChapterDraftRow; content: string; summary: string | null; wordCount: number | null }
  | { row: ChapterFinalRow; content: string; summary: string | null; wordCount: number | null };

export class ChapterService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createChapterSchema>): Promise<ChapterRow> {
    const payload = createChapterSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      { event: "db.create", table: "chapters", entityType: "chapter", bookId: payload.bookId },
      async (db) =>
        new ChapterRepository(db).create({
          book_id: payload.bookId,
          chapter_no: payload.chapterNo,
          title: payload.title ?? null,
          summary: payload.summary ?? null,
          word_count: payload.wordCount ?? null,
          status: payload.status,
          current_plan_id: null,
          current_draft_id: null,
          current_review_id: null,
          current_final_id: null,
          actual_character_ids: payload.actualCharacterIds ?? null,
          actual_faction_ids: payload.actualFactionIds ?? null,
          actual_item_ids: payload.actualItemIds ?? null,
          actual_hook_ids: payload.actualHookIds ?? null,
          actual_world_setting_ids: payload.actualWorldSettingIds ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<ChapterRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "chapters", entityType: "chapter", bookId, limit, status },
      async (db) => new ChapterRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(bookId: number, chapterNo: number): Promise<ChapterRow> {
    return executeDbAction(
      this.logger,
      {
        event: "db.get",
        table: "chapters",
        entityType: "chapter",
        bookId,
        chapterNo,
      },
      async (db) => {
        const record = await new ChapterRepository(db).getByBookAndChapterNo(bookId, chapterNo);
        if (!record) {
          throw new Error(`Chapter not found: book=${bookId}, chapter=${chapterNo}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateChapterSchema>): Promise<ChapterRow> {
    const payload = updateChapterSchema.parse(input);

    return executeDbAction(
      this.logger,
      {
        event: "db.update",
        table: "chapters",
        entityType: "chapter",
        bookId: payload.bookId,
        chapterNo: payload.chapterNo,
      },
      async (db) => {
        const record = await new ChapterRepository(db).updateByBookAndChapterNo(
          payload.bookId,
          payload.chapterNo,
          omitUndefined({
            title: payload.title,
            summary: payload.summary,
            word_count: payload.wordCount,
            status: payload.status,
            actual_character_ids: payload.actualCharacterIds,
            actual_faction_ids: payload.actualFactionIds,
            actual_item_ids: payload.actualItemIds,
            actual_hook_ids: payload.actualHookIds,
            actual_world_setting_ids: payload.actualWorldSettingIds,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
        }

        return record;
      },
    );
  }

  async remove(bookId: number, chapterNo: number): Promise<void> {
    await executeDbAction(
      this.logger,
      {
        event: "db.delete",
        table: "chapters",
        entityType: "chapter",
        bookId,
        chapterNo,
      },
      async (db) => {
        const deleted = await new ChapterRepository(db).deleteByBookAndChapterNo(bookId, chapterNo);
        if (!deleted) {
          throw new Error(`Chapter not found: book=${bookId}, chapter=${chapterNo}`);
        }
      },
    );
  }

  async exportStage(input: z.input<typeof exportChapterSchema>): Promise<{ outputPath: string }> {
    const payload = exportChapterSchema.parse(input);

    return executeDbAction(
      this.logger,
      {
        event: "chapter.export",
        table: "chapters",
        entityType: "chapter",
        bookId: payload.bookId,
        chapterNo: payload.chapterNo,
        stage: payload.stage,
      },
      async (db) => {
        const chapter = await this.requireChapter(db, payload.bookId, payload.chapterNo);
        const artifact = await this.loadStageArtifact(db, chapter, payload.stage);
        const markdown = formatChapterMarkdown({
          metadata: {
            bookId: payload.bookId,
            chapterNo: payload.chapterNo,
            stage: payload.stage,
            title: chapter.title,
            status: chapter.status,
            wordCount: artifact.wordCount ?? chapter.word_count,
            updatedAt: artifact.row.updated_at,
          },
          summary: artifact.summary ?? chapter.summary,
          content: artifact.content,
        });

        await fs.mkdir(path.dirname(payload.outputPath), { recursive: true });
        await fs.writeFile(payload.outputPath, markdown, "utf8");

        return { outputPath: payload.outputPath };
      },
    );
  }

  async importStage(input: z.input<typeof importChapterSchema>): Promise<ChapterRow> {
    const payload = importChapterSchema.parse(input);

    return executeDbAction(
      this.logger,
      {
        event: "chapter.import",
        table: "chapters",
        entityType: "chapter",
        bookId: payload.bookId,
        chapterNo: payload.chapterNo,
        stage: payload.stage,
      },
      async (db) => {
        const rawMarkdown = await fs.readFile(payload.inputPath, "utf8");
        const parsed = parseChapterMarkdown(rawMarkdown);

        if (parsed.metadata.bookId !== payload.bookId) {
          throw new Error("Imported markdown book_id does not match CLI argument");
        }

        if (parsed.metadata.chapterNo !== payload.chapterNo) {
          throw new Error("Imported markdown chapter_no does not match CLI argument");
        }

        if (parsed.metadata.stage !== payload.stage) {
          throw new Error("Imported markdown stage does not match CLI argument");
        }

        return db.transaction().execute(async (trx) => {
          const bookRepository = new BookRepository(trx);
          const chapterRepository = new ChapterRepository(trx);
          const chapter = await this.requireChapter(trx, payload.bookId, payload.chapterNo);
          const timestamp = nowIso();
          const wordCount = estimateWordCount(parsed.content);
          const title = parsed.title ?? chapter.title;
          const summary = parsed.summary ?? chapter.summary;

          if (payload.stage === "final" && chapter.status !== CHAPTER_STATUS.APPROVED && !payload.force) {
            throw new Error("Importing final content requires approved chapter status or --force");
          }

          let nextStatus = chapter.status;
          let currentPlanId = chapter.current_plan_id;
          let currentDraftId = chapter.current_draft_id;
          let currentFinalId = chapter.current_final_id;

          if (payload.stage === "plan") {
            const repository = new ChapterPlanRepository(trx);
            const previousPlan = chapter.current_plan_id
              ? await repository.getById(chapter.current_plan_id)
              : undefined;
            const versionNo = (await repository.getLatestVersionNo(chapter.id)) + 1;
            const created = await repository.create({
              book_id: chapter.book_id,
              chapter_id: chapter.id,
              chapter_no: chapter.chapter_no,
              version_no: versionNo,
              status: CHAPTER_SOURCE_TYPE.IMPORTED,
              author_intent:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.author_intent
                  : null,
              intent_source: PLAN_INTENT_SOURCE.MANUAL_IMPORT,
              intent_summary:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.intent_summary
                  : null,
              intent_keywords:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.intent_keywords
                  : null,
              intent_must_include:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.intent_must_include
                  : null,
              intent_must_avoid:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.intent_must_avoid
                  : null,
              manual_entity_refs:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.manual_entity_refs
                  : null,
              retrieved_context:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.retrieved_context
                  : null,
              content: parsed.content,
              model:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.model
                  : null,
              provider:
                previousPlan && previousPlan.chapter_id === chapter.id && previousPlan.book_id === chapter.book_id
                  ? previousPlan.provider
                  : null,
              source_type: CHAPTER_SOURCE_TYPE.IMPORTED,
              created_at: timestamp,
              updated_at: timestamp,
            });
            currentPlanId = created.id;
            if (chapter.status === CHAPTER_STATUS.TODO) {
              nextStatus = CHAPTER_STATUS.PLANNED;
            }
          }

          if (payload.stage === "draft") {
            const repository = new ChapterDraftRepository(trx);
            const versionNo = (await repository.getLatestVersionNo(chapter.id)) + 1;
            const created = await repository.create({
              book_id: chapter.book_id,
              chapter_id: chapter.id,
              chapter_no: chapter.chapter_no,
              version_no: versionNo,
              based_on_plan_id: chapter.current_plan_id,
              based_on_draft_id: chapter.current_draft_id,
              based_on_review_id: chapter.current_review_id,
              status: CHAPTER_SOURCE_TYPE.IMPORTED,
              content: parsed.content,
              summary,
              word_count: wordCount,
              model: null,
              provider: null,
              source_type: CHAPTER_SOURCE_TYPE.IMPORTED,
              created_at: timestamp,
              updated_at: timestamp,
            });
            currentDraftId = created.id;
            nextStatus = CHAPTER_STATUS.DRAFTED;
          }

          if (payload.stage === "final") {
            const repository = new ChapterFinalRepository(trx);
            const versionNo = (await repository.getLatestVersionNo(chapter.id)) + 1;
            const created = await repository.create({
              book_id: chapter.book_id,
              chapter_id: chapter.id,
              chapter_no: chapter.chapter_no,
              version_no: versionNo,
              based_on_draft_id: chapter.current_draft_id,
              status: CHAPTER_SOURCE_TYPE.IMPORTED,
              content: parsed.content,
              summary,
              word_count: wordCount,
              source_type: CHAPTER_SOURCE_TYPE.IMPORTED,
              created_at: timestamp,
              updated_at: timestamp,
            });
            currentFinalId = created.id;
            nextStatus = CHAPTER_STATUS.APPROVED;
          }

          const updated = await chapterRepository.updateByBookAndChapterNo(payload.bookId, payload.chapterNo, {
            title,
            summary,
            word_count: payload.stage === "plan" ? chapter.word_count : wordCount,
            current_plan_id: currentPlanId,
            current_draft_id: currentDraftId,
            current_final_id: currentFinalId,
            status: nextStatus,
            updated_at: timestamp,
          });

          if (!updated) {
            throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
          }

          const approvedCountRow = await trx
            .selectFrom("chapters")
            .select((expressionBuilder) => expressionBuilder.fn.count<number>("id").as("approved_count"))
            .where("book_id", "=", payload.bookId)
            .where("status", "=", CHAPTER_STATUS.APPROVED)
            .executeTakeFirstOrThrow();

          await bookRepository.updateById(payload.bookId, {
            current_chapter_count: Number(approvedCountRow.approved_count),
            updated_at: timestamp,
          });

          return updated;
        });
      },
    );
  }

  private async requireChapter(
    db: Parameters<typeof executeDbAction<ChapterRow>>[2] extends (db: infer T) => Promise<unknown>
      ? T
      : never,
    bookId: number,
    chapterNo: number,
  ): Promise<ChapterRow> {
    const chapter = await new ChapterRepository(db).getByBookAndChapterNo(bookId, chapterNo);

    if (!chapter) {
      throw new Error(`Chapter not found: book=${bookId}, chapter=${chapterNo}`);
    }

    return chapter;
  }

  private async loadStageArtifact(
    db: Parameters<typeof executeDbAction<ChapterRow>>[2] extends (db: infer T) => Promise<unknown>
      ? T
      : never,
    chapter: ChapterRow,
    stage: ChapterStage,
  ): Promise<StageArtifact> {
    if (stage === "plan") {
      if (!chapter.current_plan_id) {
        throw new Error("Chapter does not have a current plan");
      }

      const row = await new ChapterPlanRepository(db).getById(chapter.current_plan_id);
      if (!row || row.chapter_id !== chapter.id || row.book_id !== chapter.book_id) {
        throw new Error("Current plan pointer is invalid");
      }

      return { row, content: row.content, summary: null, wordCount: null };
    }

    if (stage === "draft") {
      if (!chapter.current_draft_id) {
        throw new Error("Chapter does not have a current draft");
      }

      const row = await new ChapterDraftRepository(db).getById(chapter.current_draft_id);
      if (!row || row.chapter_id !== chapter.id || row.book_id !== chapter.book_id) {
        throw new Error("Current draft pointer is invalid");
      }

      return { row, content: row.content, summary: row.summary, wordCount: row.word_count };
    }

    if (!chapter.current_final_id) {
      throw new Error("Chapter does not have a current final");
    }

    const row = await new ChapterFinalRepository(db).getById(chapter.current_final_id);
    if (!row || row.chapter_id !== chapter.id || row.book_id !== chapter.book_id) {
      throw new Error("Current final pointer is invalid");
    }

    return { row, content: row.content, summary: row.summary, wordCount: row.word_count };
  }
}
