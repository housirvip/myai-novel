import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterDraftRepository } from "../../core/db/repositories/chapter-draft-repository.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { nowIso } from "../../shared/utils/time.js";
import { estimateWordCount } from "../../shared/utils/word-count.js";
import { buildDraftPrompt } from "../planning/prompts.js";

const runDraftWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
  targetWords: z.number().int().positive().optional(),
});

export class DraftChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

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
        async () =>
          manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterPlanRepository = new ChapterPlanRepository(trx);
            const chapterDraftRepository = new ChapterDraftRepository(trx);
            const chapter = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

            if (!chapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            if (!chapter.current_plan_id) {
              throw new Error(
                `Chapter does not have a current plan: book=${payload.bookId}, chapter=${payload.chapterNo}`,
              );
            }

            const currentPlan = await chapterPlanRepository.getById(chapter.current_plan_id);

            if (!currentPlan || currentPlan.chapter_id !== chapter.id || currentPlan.book_id !== payload.bookId) {
              throw new Error("Current plan pointer is invalid");
            }

            const retrievedContext = parseStoredJson(currentPlan.retrieved_context);
            const draftResult = await llmClient.generate({
              model: payload.model,
              messages: buildDraftPrompt({
                planContent: currentPlan.content,
                retrievedContext,
                targetWords: payload.targetWords,
              }),
            });

            const timestamp = nowIso();
            const wordCount = estimateWordCount(draftResult.content);
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
              source_type: chapter.current_review_id ? "repaired" : "ai_generated",
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_draft_id: created.id,
                word_count: wordCount,
                status: "drafted",
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
