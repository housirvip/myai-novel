import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterDraftRepository } from "../../core/db/repositories/chapter-draft-repository.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { ChapterReviewRepository } from "../../core/db/repositories/chapter-review-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { parseLooseJson } from "../../shared/utils/json.js";
import { nowIso } from "../../shared/utils/time.js";
import { buildReviewPrompt } from "../planning/prompts.js";

const reviewResultSchema = z.object({
  summary: z.string().min(1),
  issues: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  continuity_checks: z.array(z.string().min(1)).default([]),
  repair_suggestions: z.array(z.string().min(1)).default([]),
});

const runReviewWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
});

export class ReviewChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

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
        async () =>
          manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterPlanRepository = new ChapterPlanRepository(trx);
            const chapterDraftRepository = new ChapterDraftRepository(trx);
            const chapterReviewRepository = new ChapterReviewRepository(trx);
            const chapter = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

            if (!chapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            if (!chapter.current_plan_id || !chapter.current_draft_id) {
              throw new Error(
                `Chapter needs both current plan and draft before review: book=${payload.bookId}, chapter=${payload.chapterNo}`,
              );
            }

            const currentPlan = await chapterPlanRepository.getById(chapter.current_plan_id);
            const currentDraft = await chapterDraftRepository.getById(chapter.current_draft_id);

            if (!currentPlan || currentPlan.chapter_id !== chapter.id || currentPlan.book_id !== payload.bookId) {
              throw new Error("Current plan pointer is invalid");
            }

            if (!currentDraft || currentDraft.chapter_id !== chapter.id || currentDraft.book_id !== payload.bookId) {
              throw new Error("Current draft pointer is invalid");
            }

            const retrievedContext = parseStoredJson(currentPlan.retrieved_context);
            const reviewResponse = await llmClient.generate({
              model: payload.model,
              messages: buildReviewPrompt({
                planContent: currentPlan.content,
                draftContent: currentDraft.content,
                retrievedContext,
              }),
              responseFormat: "json",
            });
            const parsedReview = reviewResultSchema.parse(parseLooseJson(reviewResponse.content));

            const timestamp = nowIso();
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
              source_type: "ai_generated",
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_review_id: created.id,
                status: "reviewed",
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
          }),
      );
    } finally {
      await manager.destroy();
    }
  }
}

function parseStoredJson(value: string | null): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
