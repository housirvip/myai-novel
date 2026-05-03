import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { ChapterReviewRepository } from "../../core/db/repositories/chapter-review-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import { resolveLlmModel } from "../../core/llm/model-routing.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { parseLooseJson } from "../../shared/utils/json.js";
import { nowIso } from "../../shared/utils/time.js";
import { buildReviewContextView } from "../planning/context-views.js";
import { buildReviewPrompt } from "../planning/prompts.js";
import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS } from "../shared/constants.js";
import { assertChapterPointersUnchanged, parseStoredJson } from "./shared.js";

const reviewResultSchema = z.object({
  summary: z.string().min(1),
  issues: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  continuity_checks: z.array(z.string().min(1)).default([]),
  repair_suggestions: z.array(z.string().min(1)).default([]),
});

const reviewResultLooseSchema = z.object({
  summary: z.string().min(1),
  issues: z.union([z.string(), z.array(z.union([z.string(), z.record(z.unknown())]))]).default([]),
  risks: z.union([z.string(), z.array(z.union([z.string(), z.record(z.unknown())]))]).default([]),
  continuity_checks: z
    .union([z.array(z.union([z.string(), z.record(z.unknown())])), z.record(z.unknown())])
    .default([]),
  repair_suggestions: z
    .union([z.string(), z.array(z.union([z.string(), z.record(z.unknown())]))])
    .default([]),
});

const runReviewWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
});

export class ReviewChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

  // review 负责把“草稿是否违反规划和事实边界”转成结构化结果，
  // 其输出会直接被 repair 使用，因此这里必须维持稳定的 JSON 协议。
  async run(
    input: z.input<typeof runReviewWorkflowSchema>,
  ): Promise<{
    chapterId: number;
    reviewId: number;
    draftId: number;
    rawResult: z.infer<typeof reviewResultSchema>;
  }> {
    const payload = runReviewWorkflowSchema.parse(input);
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "workflow.review",
          entityType: "chapter_review",
          bookId: payload.bookId,
          chapterNo: payload.chapterNo,
        },
        async () => {
          const chapter = await manager.getClient()
            .selectFrom("chapters")
            .selectAll()
            .where("book_id", "=", payload.bookId)
            .where("chapter_no", "=", payload.chapterNo)
            .executeTakeFirst();

          if (!chapter) {
            throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
          }

          if (!chapter.current_plan_id || !chapter.current_draft_id) {
            throw new Error(
              `Chapter needs both current plan and draft before review: book=${payload.bookId}, chapter=${payload.chapterNo}`,
            );
          }

          const currentPlan = await manager.getClient()
            .selectFrom("chapter_plans")
            .selectAll()
            .where("id", "=", chapter.current_plan_id)
            .executeTakeFirst();
          const currentDraft = await manager.getClient()
            .selectFrom("chapter_drafts")
            .selectAll()
            .where("id", "=", chapter.current_draft_id)
            .executeTakeFirst();

          if (!currentPlan || currentPlan.chapter_id !== chapter.id || currentPlan.book_id !== payload.bookId) {
            throw new Error("Current plan pointer is invalid");
          }

          if (!currentDraft || currentDraft.chapter_id !== chapter.id || currentDraft.book_id !== payload.bookId) {
            throw new Error("Current draft pointer is invalid");
          }

          const retrievedContext = parseStoredJson(currentPlan.retrieved_context);
          const reviewContextView = buildReviewContextView(retrievedContext as import("../planning/types.js").PlanRetrievedContext);
          const reviewResponse = await llmClient.generate({
            model: resolveLlmModel({ explicitModel: payload.model, tier: "low" }),
            messages: buildReviewPrompt({
              planContent: currentPlan.content,
              draftContent: currentDraft.content,
              retrievedContext: reviewContextView,
            }),
            responseFormat: "json",
          });
          const parsedReview = reviewResultSchema.parse(
            normalizeReviewResult(reviewResultLooseSchema.parse(parseLooseJson(reviewResponse.content))),
          );

          const timestamp = nowIso();

          // review 版本落库与 current_review_id 切换必须同步提交，
          // 否则 repair 可能读取到“章节已指向新 review，但 review 行还未落库完成”的中间态。
          return manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterReviewRepository = new ChapterReviewRepository(trx);
            const chapterBeforeCommit = await chapterRepository.getByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
            );

            if (!chapterBeforeCommit) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            assertChapterPointersUnchanged(chapterBeforeCommit, {
              currentPlanId: chapter.current_plan_id,
              currentDraftId: chapter.current_draft_id,
            });

            const versionNo = (await chapterReviewRepository.getLatestVersionNo(chapter.id)) + 1;
            const created = await chapterReviewRepository.create({
              book_id: payload.bookId,
              chapter_id: chapter.id,
              chapter_no: payload.chapterNo,
              draft_id: currentDraft.id,
              version_no: versionNo,
              status: "active",
              summary: parsedReview.summary,
              issues: JSON.stringify(parsedReview.issues),
              risks: JSON.stringify(parsedReview.risks),
              continuity_checks: JSON.stringify(parsedReview.continuity_checks),
              repair_suggestions: JSON.stringify(parsedReview.repair_suggestions),
              raw_result: JSON.stringify(parsedReview),
              model: reviewResponse.model,
              provider: reviewResponse.provider,
              source_type: CHAPTER_SOURCE_TYPE.AI_GENERATED,
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_review_id: created.id,
                status: CHAPTER_STATUS.REVIEWED,
                updated_at: timestamp,
              },
            );

            if (!updatedChapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            return {
              chapterId: chapter.id,
              reviewId: created.id,
              draftId: currentDraft.id,
              rawResult: parsedReview,
            };
          });
        },

      );
    } finally {
      await manager.destroy();
    }
  }
}

function normalizeReviewResult(input: z.infer<typeof reviewResultLooseSchema>): z.infer<typeof reviewResultSchema> {
  return {
    summary: input.summary.trim(),
    issues: normalizeReviewList(input.issues),
    risks: normalizeReviewList(input.risks),
    continuity_checks: Array.isArray(input.continuity_checks)
      ? normalizeReviewList(input.continuity_checks)
      : normalizeContinuityChecks(input.continuity_checks),
    repair_suggestions: normalizeReviewList(input.repair_suggestions),
  };
}

function normalizeReviewList(items: string | Array<string | Record<string, unknown>>): string[] {
  const normalizedItems = typeof items === "string" ? [items] : items;

  return normalizedItems
    .map((item) => normalizeReviewItem(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeReviewItem(item: string | Record<string, unknown>): string | null {
  if (typeof item === "string") {
    const normalized = item.trim();
    return normalized.length > 0 ? normalized : null;
  }

  const preferredKeys = [
    "issue",
    "risk",
    "suggestion",
    "title",
    "description",
    "detail",
    "content",
    "problem",
    "finding",
    "message",
    "summary",
  ];

  for (const key of preferredKeys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  const flattened = Object.entries(item)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}: ${value.trim()}`;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return `${key}: ${String(value)}`;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value))
    .join("; ")
    .trim();

  return flattened.length > 0 ? flattened : null;
}

function normalizeContinuityChecks(input: Record<string, unknown>): string[] {
  return Object.entries(input)
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => normalizeReviewItem(typeof item === "string" ? item : (item as Record<string, unknown>)))
          .filter((item): item is string => Boolean(item))
          .map((item) => `${key}: ${item}`);
      }

      if (typeof value === "string" && value.trim().length > 0) {
        return [`${key}: ${value.trim()}`];
      }

      if (value && typeof value === "object") {
        const normalized = normalizeReviewItem(value as Record<string, unknown>);
        return normalized ? [`${key}: ${normalized}`] : [];
      }

      return [];
    })
    .filter((item) => item.trim().length > 0);
}
