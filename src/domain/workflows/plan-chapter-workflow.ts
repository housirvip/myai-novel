import { z } from "zod";

import { createDatabaseManager } from "../../core/db/client.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { parseLooseJson } from "../../shared/utils/json.js";
import { nowIso } from "../../shared/utils/time.js";
import { extractedIntentSchema, planInputSchema } from "../planning/input.js";
import {
  buildIntentGenerationPrompt,
  buildKeywordExtractionPrompt,
  buildPlanPrompt,
} from "../planning/prompts.js";
import { RetrievalQueryService } from "../planning/retrieval-service.js";
import type {
  ExtractedIntentPayload,
  ManualEntityRefs,
  PlanIntentConstraints,
  PlanRetrievedContext,
} from "../planning/types.js";

const runPlanWorkflowSchema = planInputSchema.extend({
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
});

export class PlanChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

  async run(
    input: z.input<typeof runPlanWorkflowSchema>,
  ): Promise<{
    chapterId: number;
    planId: number;
    authorIntent: string;
    intentSource: string;
    intentKeywords: string[];
    intentSummary: string;
    mustInclude: string[];
    mustAvoid: string[];
    retrievedContext: PlanRetrievedContext;
    content: string;
  }> {
    const payload = runPlanWorkflowSchema.parse(input);
    const retrievalService = new RetrievalQueryService(this.logger);
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);

    return withTimingLog(
      this.logger,
      {
        event: "workflow.plan",
        entityType: "chapter_plan",
        bookId: payload.bookId,
        chapterNo: payload.chapterNo,
      },
      async () => {
        const initialContext = await retrievalService.retrievePlanContext({
          bookId: payload.bookId,
          chapterNo: payload.chapterNo,
          keywords: [],
          manualRefs: payload.manualEntityRefs,
        });

        const authorIntent =
          payload.authorIntent ??
          (
            await llmClient.generate({
              model: payload.model,
              messages: buildIntentGenerationPrompt({
                bookTitle: initialContext.book.title,
                chapterNo: payload.chapterNo,
                outlinesText: formatOutlines(initialContext),
                recentChapterText: formatRecentChapters(initialContext),
                manualFocusText: formatManualFocus(initialContext),
              }),
            })
          ).content;

        const intentSource = payload.authorIntent ? "user_input" : "ai_generated";
        const keywordResult = await llmClient.generate({
          model: payload.model,
          messages: buildKeywordExtractionPrompt({ authorIntent }),
          responseFormat: "json",
        });
        const extractedIntent = extractedIntentSchema.parse(parseLooseJson(keywordResult.content));
        const intentConstraints = toIntentConstraints(extractedIntent);

        const retrievedContext = await retrievalService.retrievePlanContext({
          bookId: payload.bookId,
          chapterNo: payload.chapterNo,
          keywords: extractedIntent.keywords,
          manualRefs: payload.manualEntityRefs,
        });

        const planResult = await llmClient.generate({
          model: payload.model,
            messages: buildPlanPrompt({
              bookTitle: retrievedContext.book.title,
              chapterNo: payload.chapterNo,
              authorIntent,
              intentConstraints,
              retrievedContext,
            }),
          });

        const manager = createDatabaseManager(this.logger);

        try {
          return await manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterPlanRepository = new ChapterPlanRepository(trx);
            const chapter = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

            if (!chapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            const versionNo = (await chapterPlanRepository.getLatestVersionNo(chapter.id)) + 1;
            const timestamp = nowIso();
            const created = await chapterPlanRepository.create({
              book_id: payload.bookId,
              chapter_id: chapter.id,
              chapter_no: payload.chapterNo,
              version_no: versionNo,
              status: "active",
              author_intent: authorIntent,
              intent_source: intentSource,
              intent_summary: extractedIntent.intentSummary,
              intent_keywords: JSON.stringify(extractedIntent.keywords),
              intent_must_include: JSON.stringify(extractedIntent.mustInclude),
              intent_must_avoid: JSON.stringify(extractedIntent.mustAvoid),
              manual_entity_refs: JSON.stringify(payload.manualEntityRefs),
              retrieved_context: JSON.stringify(retrievedContext),
              content: planResult.content,
              model: planResult.model,
              provider: planResult.provider,
              source_type: "ai_generated",
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_plan_id: created.id,
                status: "planned",
                updated_at: timestamp,
              },
            );

            if (!updatedChapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            return {
              chapterId: chapter.id,
              planId: created.id,
              authorIntent,
              intentSource,
              intentKeywords: extractedIntent.keywords,
              intentSummary: extractedIntent.intentSummary,
              mustInclude: extractedIntent.mustInclude,
              mustAvoid: extractedIntent.mustAvoid,
              retrievedContext,
              content: planResult.content,
            };
          });
        } finally {
          await manager.destroy();
        }
      },
    );
  }
}

function formatOutlines(context: PlanRetrievedContext): string {
  if (context.outlines.length === 0) {
    return "暂无命中大纲。";
  }

  return context.outlines.map((outline) => `- ${outline.content}`).join("\n");
}

function formatRecentChapters(context: PlanRetrievedContext): string {
  if (context.recentChapters.length === 0) {
    return "暂无前文章节。";
  }

  return context.recentChapters
    .map(
      (chapter) =>
        `- 第${chapter.chapterNo}章 ${chapter.title ?? "未命名"}：${chapter.summary ?? "无摘要"}`,
    )
    .join("\n");
}

function formatManualFocus(context: PlanRetrievedContext): string {
  const sections = [
    formatEntityNames("人物", context.characters.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("势力", context.factions.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("物品", context.items.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("钩子", context.hooks.map((entity) => entity.title ?? `ID:${entity.id}`)),
    formatEntityNames(
      "关系",
      context.relations.map((entity) => entity.content.split("\n").slice(0, 2).join(" / ")),
    ),
    formatEntityNames("世界设定", context.worldSettings.map((entity) => entity.title ?? `ID:${entity.id}`)),
  ].filter(Boolean);

  return sections.length > 0 ? sections.join("\n") : "无";
}

function formatEntityNames(label: string, values: string[]): string | null {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return null;
  }
  return `${label}：${normalized.join("；")}`;
}

function toIntentConstraints(extractedIntent: ExtractedIntentPayload): PlanIntentConstraints {
  return {
    intentSummary: extractedIntent.intentSummary,
    mustInclude: extractedIntent.mustInclude,
    mustAvoid: extractedIntent.mustAvoid,
  };
}

export function createEmptyManualEntityRefs(): ManualEntityRefs {
  return {
    characterIds: [],
    factionIds: [],
    itemIds: [],
    hookIds: [],
    relationIds: [],
    worldSettingIds: [],
  };
}
