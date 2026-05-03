import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterDraftRepository } from "../../core/db/repositories/chapter-draft-repository.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { ChapterReviewRepository } from "../../core/db/repositories/chapter-review-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import { resolveLlmModel } from "../../core/llm/model-routing.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { nowIso } from "../../shared/utils/time.js";
import { estimateWordCount } from "../../shared/utils/word-count.js";
import { buildRepairContextView } from "../planning/context-views.js";
import { buildRepairPrompt } from "../planning/prompts.js";
import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS } from "../shared/constants.js";
import { assertChapterPointersUnchanged, parseStoredJson, readPlanIntentConstraints } from "./shared.js";

const runRepairWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
});

export class RepairChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

  // repair 不是重新自由创作，而是在既有 plan、当前 draft、当前 review 的共同边界内修复问题。
  async run(
    input: z.input<typeof runRepairWorkflowSchema>,
  ): Promise<{
    chapterId: number;
    draftId: number;
    basedOnDraftId: number;
    basedOnReviewId: number;
    wordCount: number;
    content: string;
  }> {
    const payload = runRepairWorkflowSchema.parse(input);
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "workflow.repair",
          entityType: "chapter_draft",
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

          if (!chapter.current_plan_id || !chapter.current_draft_id || !chapter.current_review_id) {
            throw new Error(
              `Chapter needs current plan, draft and review before repair: book=${payload.bookId}, chapter=${payload.chapterNo}`,
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
          const currentReview = await manager.getClient()
            .selectFrom("chapter_reviews")
            .selectAll()
            .where("id", "=", chapter.current_review_id)
            .executeTakeFirst();

          if (!currentPlan || currentPlan.chapter_id !== chapter.id || currentPlan.book_id !== payload.bookId) {
            throw new Error("Current plan pointer is invalid");
          }

          if (!currentDraft || currentDraft.chapter_id !== chapter.id || currentDraft.book_id !== payload.bookId) {
            throw new Error("Current draft pointer is invalid");
          }

          if (!currentReview || currentReview.chapter_id !== chapter.id || currentReview.book_id !== payload.bookId) {
            throw new Error("Current review pointer is invalid");
          }

          const retrievedContext = parseStoredJson(currentPlan.retrieved_context);
          const repairContextView = buildRepairContextView(retrievedContext as import("../planning/types.js").PlanRetrievedContext);
          const repairResult = await llmClient.generate({
            model: resolveLlmModel({ explicitModel: payload.model, tier: "high" }),
            messages: buildRepairPrompt({
              planContent: currentPlan.content,
              draftContent: currentDraft.content,
              reviewContent: currentReview.raw_result,
              intentConstraints: readPlanIntentConstraints(currentPlan),
              retrievedContext: repairContextView,
            }),
          });

          const timestamp = nowIso();
          const wordCount = estimateWordCount(repairResult.content);

          // repair 会生成一个新的 draft 版本，并把章节 current_draft_id 切到新版本；
          // 因此也需要在提交前确认依赖的 plan/draft/review pointers 没有被并发修改。
          return manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterDraftRepository = new ChapterDraftRepository(trx);
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
              currentReviewId: chapter.current_review_id,
            });

            const versionNo = (await chapterDraftRepository.getLatestVersionNo(chapter.id)) + 1;
            const created = await chapterDraftRepository.create({
              book_id: payload.bookId,
              chapter_id: chapter.id,
              chapter_no: payload.chapterNo,
              version_no: versionNo,
              based_on_plan_id: currentDraft.based_on_plan_id,
              based_on_draft_id: currentDraft.id,
              based_on_review_id: currentReview.id,
              status: "active",
              content: repairResult.content,
              summary: currentDraft.summary,
              word_count: wordCount,
              model: repairResult.model,
              provider: repairResult.provider,
              source_type: CHAPTER_SOURCE_TYPE.REPAIRED,
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_draft_id: created.id,
                word_count: wordCount,
                status: CHAPTER_STATUS.REPAIRED,
                updated_at: timestamp,
              },
            );

            if (!updatedChapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            return {
              chapterId: chapter.id,
              draftId: created.id,
              basedOnDraftId: currentDraft.id,
              basedOnReviewId: currentReview.id,
              wordCount,
              content: repairResult.content,
            };
          });
        },

      );
    } finally {
      await manager.destroy();
    }
  }
}
