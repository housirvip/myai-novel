import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterDraftRepository } from "../../core/db/repositories/chapter-draft-repository.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import { resolveLlmModel } from "../../core/llm/model-routing.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { nowIso } from "../../shared/utils/time.js";
import { estimateWordCount } from "../../shared/utils/word-count.js";
import { buildDraftContextView } from "../planning/context-views.js";
import { buildDraftPrompt } from "../planning/prompts.js";
import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS } from "../shared/constants.js";
import { assertChapterPointersUnchanged, parseStoredJson, readPlanIntentConstraints } from "./shared.js";

const runDraftWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
  targetWords: z.number().int().positive().optional(),
});

export class DraftChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

  // draft 不会重新做数据库召回，而是直接复用 current plan 中已经固化的 retrieved_context。
  // 这样可以保证 plan 与 draft 使用同一套事实边界，避免多次生成时上下文漂移。
  async run(
    input: z.input<typeof runDraftWorkflowSchema>,
  ): Promise<{
    chapterId: number;
    draftId: number;
    basedOnPlanId: number;
    wordCount: number;
    content: string;
  }> {
    const payload = runDraftWorkflowSchema.parse(input);
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "workflow.draft",
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

          if (!chapter.current_plan_id) {
            throw new Error(
              `Chapter does not have a current plan: book=${payload.bookId}, chapter=${payload.chapterNo}`,
            );
          }

          const currentPlan = await manager.getClient()
            .selectFrom("chapter_plans")
            .selectAll()
            .where("id", "=", chapter.current_plan_id)
            .executeTakeFirst();

          if (!currentPlan || currentPlan.chapter_id !== chapter.id || currentPlan.book_id !== payload.bookId) {
            throw new Error("Current plan pointer is invalid");
          }

          const retrievedContext = parseStoredJson(currentPlan.retrieved_context);
          const draftContextView = buildDraftContextView(retrievedContext as import("../planning/types.js").PlanRetrievedContext);
          const draftResult = await llmClient.generate({
            model: resolveLlmModel({ explicitModel: payload.model, tier: "high" }),
            messages: buildDraftPrompt({
              planContent: currentPlan.content,
              intentConstraints: readPlanIntentConstraints(currentPlan),
              retrievedContext: draftContextView,
              targetWords: payload.targetWords,
            }),
          });

          const timestamp = nowIso();
          const wordCount = estimateWordCount(draftResult.content);

          // 在真正写入新 draft 前再次校验章节 pointers，
          // 防止模型生成期间 plan/draft/review 已被其他操作切换。
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
              based_on_plan_id: currentPlan.id,
              based_on_draft_id: chapter.current_draft_id,
              based_on_review_id: chapter.current_review_id,
              status: "active",
              content: draftResult.content,
              summary: chapter.summary ?? currentPlan.author_intent ?? null,
              word_count: wordCount,
              model: draftResult.model,
              provider: draftResult.provider,
              source_type: chapter.current_review_id
                ? CHAPTER_SOURCE_TYPE.REPAIRED
                : CHAPTER_SOURCE_TYPE.AI_GENERATED,
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_draft_id: created.id,
                word_count: wordCount,
                status: CHAPTER_STATUS.DRAFTED,
                updated_at: timestamp,
              },
            );

            if (!updatedChapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            return {
              chapterId: chapter.id,
              draftId: created.id,
              basedOnPlanId: currentPlan.id,
              wordCount,
              content: draftResult.content,
            };
          });
        },
      );
    } finally {
      await manager.destroy();
    }
  }
}
