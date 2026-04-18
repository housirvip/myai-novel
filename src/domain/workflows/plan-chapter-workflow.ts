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
import { createPlanningRetrievalService } from "../planning/retrieval-service-factory.js";
import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS, PLAN_INTENT_SOURCE } from "../shared/constants.js";
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

  // plan 阶段会先准备一份轻量上下文，再决定是否需要让模型补全作者意图。
  // 这样做的目的不是提前做完整召回，而是避免模型在毫无上下文的情况下生成偏题意图。
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
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);
    const manager = createDatabaseManager(this.logger);

    return withTimingLog(
      this.logger,
      {
        event: "workflow.plan",
        entityType: "chapter_plan",
        bookId: payload.bookId,
        chapterNo: payload.chapterNo,
      },
      async () => {
        try {
          const retrievalService = await createPlanningRetrievalService(
            this.logger,
            manager.getClient(),
            { bookId: payload.bookId },
          );
          const initialContext = await retrievalService.retrievePlanContext({
            bookId: payload.bookId,
            chapterNo: payload.chapterNo,
            keywords: [],
            manualRefs: payload.manualEntityRefs,
          });

        // 如果用户已经明确给出 authorIntent，就直接沿用用户输入；
        // 否则才用“轻量上下文”生成一版意图草案，避免无关设定过早干扰意图提炼。
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

          const intentSource = payload.authorIntent
            ? PLAN_INTENT_SOURCE.USER_INPUT
            : PLAN_INTENT_SOURCE.AI_GENERATED;
          const keywordResult = await llmClient.generate({
            model: payload.model,
            messages: buildKeywordExtractionPrompt({ authorIntent }),
            responseFormat: "json",
          });
          const extractedIntent = extractedIntentSchema.parse(parseLooseJson(keywordResult.content));
          const intentConstraints = toIntentConstraints(extractedIntent);

        // 第二次召回才是后续写作阶段真正共享的事实边界：
        // 这里把意图提取出的 keywords 和手工指定实体一起纳入，生成会被固化到 plan 的 retrievedContext。
          const retrievalQuery = buildRetrievalQueryPayload({
            authorIntent,
            extractedIntent,
          });

          const retrievedContext = await retrievalService.retrievePlanContext({
            bookId: payload.bookId,
            chapterNo: payload.chapterNo,
            keywords: retrievalQuery.keywords,
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

          return await manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterPlanRepository = new ChapterPlanRepository(trx);
            const chapter = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

            if (!chapter) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            const versionNo = (await chapterPlanRepository.getLatestVersionNo(chapter.id)) + 1;
            const timestamp = nowIso();
            // plan 内容、retrieved_context 和 current_plan_id 必须在同一事务里提交，
            // 否则后续 draft/review 可能读到“章节指针已切换，但 plan 正文或上下文未落库完成”的中间态。
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
              source_type: CHAPTER_SOURCE_TYPE.AI_GENERATED,
              created_at: timestamp,
              updated_at: timestamp,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_plan_id: created.id,
                status: CHAPTER_STATUS.PLANNED,
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
  if (context.softReferences.outlines.length === 0) {
    return "暂无命中大纲。";
  }

  return context.softReferences.outlines.map((outline) => `- ${outline.content}`).join("\n");
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
  // 这里只把已经进入 hardConstraints 的实体暴露给意图生成阶段，
  // 目的是让模型看到“必须关注的人/物/关系”，而不是再次被整批软召回结果带偏。
  const sections = [
    formatEntityNames("人物", context.hardConstraints.characters.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("势力", context.hardConstraints.factions.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("物品", context.hardConstraints.items.map((entity) => entity.name ?? `ID:${entity.id}`)),
    formatEntityNames("钩子", context.hardConstraints.hooks.map((entity) => entity.title ?? `ID:${entity.id}`)),
    formatEntityNames(
      "关系",
      context.hardConstraints.relations.map((entity) => entity.content.split("\n").slice(0, 2).join(" / ")),
    ),
    formatEntityNames(
      "世界设定",
      context.hardConstraints.worldSettings.map((entity) => entity.title ?? `ID:${entity.id}`),
    ),
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

function buildRetrievalQueryPayload(input: {
  authorIntent: string;
  extractedIntent: ExtractedIntentPayload;
}): {
  keywords: string[];
  queryText: string;
} {
  // 第二次召回前要把“自由文本意图”压成更稳定的检索词，
  // 这样 retrievePlanContext 可以直接消费同一组 intent 信号，而不是反复依赖整段原始意图文本。
  const keywordTerms = input.extractedIntent.keywords.flatMap((value) => splitIntoRetrievalTerms(value));
  const mustIncludeTerms = input.extractedIntent.mustInclude.flatMap((value) => splitIntoRetrievalTerms(value));
  const summaryTerms = splitIntoRetrievalTerms(input.extractedIntent.intentSummary);

  const keywords = Array.from(
    new Set(
      [
        ...keywordTerms,
        ...mustIncludeTerms,
        ...summaryTerms,
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  const queryText = [
    input.extractedIntent.intentSummary,
    ...input.extractedIntent.mustInclude,
    ...keywords,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return {
    keywords,
    queryText,
  };
}

function splitIntoRetrievalTerms(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  // 这里故意做较激进的切词和长度裁剪，
  // 因为 retrieval term 的职责是“扩召回入口”，不是保留 authorIntent 的完整语义原文。
  return value
    .split(/[\s,，、；;。.!?\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= 12);
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
