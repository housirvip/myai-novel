import type { Kysely } from "kysely";
import { z } from "zod";

import { env } from "../../config/env.js";
import { createDatabaseManager } from "../../core/db/client.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import { BookRepository } from "../../core/db/repositories/book-repository.js";
import { ChapterDraftRepository } from "../../core/db/repositories/chapter-draft-repository.js";
import { ChapterFinalRepository } from "../../core/db/repositories/chapter-final-repository.js";
import { ChapterPlanRepository } from "../../core/db/repositories/chapter-plan-repository.js";
import { ChapterRepository } from "../../core/db/repositories/chapter-repository.js";
import { ChapterReviewRepository } from "../../core/db/repositories/chapter-review-repository.js";
import { CharacterRepository } from "../../core/db/repositories/character-repository.js";
import { ChapterSegmentRepository } from "../../core/db/repositories/chapter-segment-repository.js";
import { FactionRepository } from "../../core/db/repositories/faction-repository.js";
import { ItemRepository } from "../../core/db/repositories/item-repository.js";
import { RelationRepository } from "../../core/db/repositories/relation-repository.js";
import { RetrievalDocumentRepository } from "../../core/db/repositories/retrieval-document-repository.js";
import { RetrievalFactRepository } from "../../core/db/repositories/retrieval-fact-repository.js";
import { StoryHookRepository } from "../../core/db/repositories/story-hook-repository.js";
import { StoryEventRepository } from "../../core/db/repositories/story-event-repository.js";
import { WorldSettingRepository } from "../../core/db/repositories/world-setting-repository.js";
import { createLlmFactory } from "../../core/llm/factory.js";
import type { LlmProviderName } from "../../core/llm/types.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { parseLooseJson } from "../../shared/utils/json.js";
import { nowIso } from "../../shared/utils/time.js";
import { estimateWordCount } from "../../shared/utils/word-count.js";
import { buildApproveContextView, buildApproveDiffContextView } from "../planning/context-views.js";
import { buildApproveDiffPrompt, buildApprovePrompt } from "../planning/prompts.js";

import { CHAPTER_SOURCE_TYPE, CHAPTER_STATUS } from "../shared/constants.js";
import {
  appendChapterNote,
  assertChapterPointersUnchanged,
  dedupeNumberList,
  parseStoredJson,
  readPlanIntentConstraints,
} from "./shared.js";

const approveDiffSchema = z.object({
  chapterSummary: z.string().min(1),
  unresolvedImpact: z.string().min(1).nullable().default(null),
  actualCharacterIds: z.array(z.number().int().positive()).default([]),
  actualFactionIds: z.array(z.number().int().positive()).default([]),
  actualItemIds: z.array(z.number().int().positive()).default([]),
  actualHookIds: z.array(z.number().int().positive()).default([]),
  actualWorldSettingIds: z.array(z.number().int().positive()).default([]),
  newCharacters: z
    .array(
      z.object({
        name: z.string().min(1),
        summary: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  newFactions: z
    .array(
      z.object({
        name: z.string().min(1),
        summary: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  newItems: z
    .array(
      z.object({
        name: z.string().min(1),
        summary: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  newHooks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  newWorldSettings: z
    .array(
      z.object({
        title: z.string().min(1),
        category: z.string().min(1),
        content: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  newRelations: z
    .array(
      z.object({
        sourceType: z.enum(["character", "faction"]),
        sourceId: z.number().int().positive(),
        targetType: z.enum(["character", "faction"]),
        targetId: z.number().int().positive(),
        relationType: z.string().min(1),
        intensity: z.number().int().min(-100).max(100).nullable().optional(),
        status: z.string().nullable().optional(),
        description: z.string().min(1),
        keywords: z.array(z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH)).default([]),
      }),
    )
    .default([]),
  updates: z
    .array(
      z.object({
        entityType: z.enum(["character", "faction", "relation", "item", "story_hook", "world_setting"]),
        entityId: z.number().int().positive(),
        action: z.enum(["update_fields", "append_notes", "status_change"]),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .default([]),
});

const approveDiffLooseSchema = z.object({
  chapterSummary: z.string().min(1),
  unresolvedImpact: z.union([z.string(), z.null()]).optional().default(null),
  actualCharacterIds: z.array(z.union([z.number(), z.string()])).default([]),
  actualFactionIds: z.array(z.union([z.number(), z.string()])).default([]),
  actualItemIds: z.array(z.union([z.number(), z.string()])).default([]),
  actualHookIds: z.array(z.union([z.number(), z.string()])).default([]),
  actualWorldSettingIds: z.array(z.union([z.number(), z.string()])).default([]),
  newCharacters: z.array(z.record(z.unknown())).default([]),
  newFactions: z.array(z.record(z.unknown())).default([]),
  newItems: z.array(z.record(z.unknown())).default([]),
  newHooks: z.array(z.record(z.unknown())).default([]),
  newWorldSettings: z.array(z.record(z.unknown())).default([]),
  newRelations: z.array(z.record(z.unknown())).default([]),
  updates: z.array(z.record(z.unknown())).default([]),
});

const runApproveWorkflowSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  provider: z.enum(["mock", "openai", "anthropic", "custom"]).optional(),
  model: z.string().min(1).optional(),
  dryRun: z.boolean().default(false),
});

export class ApproveChapterWorkflow {
  constructor(private readonly logger: AppLogger) {}

  // approve 是章节工作流的收口阶段：
  // 先产出可保存的 final 正文，再把正文里的新增/变化事实抽成结构化 diff，最后统一回写数据库。
  async run(
    input: z.input<typeof runApproveWorkflowSchema>,
  ): Promise<{
    chapterId: number;
    finalId?: number;
    finalContent: string;
    diff: z.infer<typeof approveDiffSchema>;
    createdEntities: Record<string, number[]>;
    updatedCount: number;
  }> {
    const payload = runApproveWorkflowSchema.parse(input);
    const llmClient = createLlmFactory(this.logger).create(payload.provider as LlmProviderName | undefined);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "workflow.approve",
          entityType: "chapter_final",
          bookId: payload.bookId,
          chapterNo: payload.chapterNo,
          dryRun: payload.dryRun,
        },
        async () => {
          const chapterRepository = new ChapterRepository(manager.getClient());
          const chapterDraftRepository = new ChapterDraftRepository(manager.getClient());
          const chapterPlanRepository = new ChapterPlanRepository(manager.getClient());
          const chapterReviewRepository = new ChapterReviewRepository(manager.getClient());

          const chapter = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

          if (!chapter) {
            throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
          }

          if (!chapter.current_plan_id || !chapter.current_draft_id || !chapter.current_review_id) {
            throw new Error(
              `Chapter needs current plan, draft and review before approve: book=${payload.bookId}, chapter=${payload.chapterNo}`,
            );
          }

          const currentPlan = await chapterPlanRepository.getById(chapter.current_plan_id);
          const currentDraft = await chapterDraftRepository.getById(chapter.current_draft_id);
          const currentReview = await chapterReviewRepository.getById(chapter.current_review_id);

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
          // approve 正文与 approve diff 对上下文的消费重点不同：
          // 正文阶段仍需要少量支撑性背景，而 diff 阶段更强调硬约束与事实核对基准。
          const approveContextView = buildApproveContextView(retrievedContext as import("../planning/types.js").PlanRetrievedContext);
          const approveDiffContextView = buildApproveDiffContextView(retrievedContext as import("../planning/types.js").PlanRetrievedContext);
          const finalResponse = await llmClient.generate({
            model: payload.model,
            messages: buildApprovePrompt({
              planContent: currentPlan.content,
              draftContent: currentDraft.content,
              reviewContent: currentReview.raw_result,
              intentConstraints: readPlanIntentConstraints(currentPlan),
              retrievedContext: approveContextView,
            }),
          });

          // 这里刻意拆成两次模型调用：
          // 第一次只负责产出最终正文，第二次再基于 final 抽取结构化 diff。
          // 这样可以把“写作质量”与“结构化回写”分开约束，减少一个 prompt 同时承担两种任务带来的漂移。
          const diffResponse = await llmClient.generate({
            model: payload.model,
            messages: buildApproveDiffPrompt({
              finalContent: finalResponse.content,
              planContent: currentPlan.content,
              reviewContent: currentReview.raw_result,
              retrievedContext: approveDiffContextView,
            }),
            responseFormat: "json",
          });
          const diff = approveDiffSchema.parse(
            normalizeApproveDiff(approveDiffLooseSchema.parse(parseLooseJson(diffResponse.content))),
          );

          const createdEntities: Record<string, number[]> = {
            characters: [],
            factions: [],
            items: [],
            hooks: [],
            worldSettings: [],
            relations: [],
          };

          const timestamp = nowIso();
          const finalWordCount = estimateWordCount(finalResponse.content);

          if (payload.dryRun) {
            return {
              chapterId: chapter.id,
              finalContent: finalResponse.content,
              diff,
              createdEntities,
              updatedCount: diff.updates.length,
            };
          }

          // dryRun 只验证模型输出与 diff 结构，不触碰数据库；
          // 正式提交时才进入事务，确保 final 版本、实体创建/更新、章节指针切换要么一起成功，要么一起回滚。
          return manager.getClient().transaction().execute(async (trx) => {
            const chapterRepository = new ChapterRepository(trx);
            const chapterDraftRepository = new ChapterDraftRepository(trx);
            const chapterFinalRepository = new ChapterFinalRepository(trx);
            const bookRepository = new BookRepository(trx);
            const characterRepository = new CharacterRepository(trx);
            const factionRepository = new FactionRepository(trx);
            const relationRepository = new RelationRepository(trx);
            const itemRepository = new ItemRepository(trx);
            const hookRepository = new StoryHookRepository(trx);
            const storyEventRepository = new StoryEventRepository(trx);
            const chapterSegmentRepository = new ChapterSegmentRepository(trx);
            const retrievalDocumentRepository = new RetrievalDocumentRepository(trx);
            const retrievalFactRepository = new RetrievalFactRepository(trx);
            const worldSettingRepository = new WorldSettingRepository(trx);

            const chapterBeforeCommit = await chapterRepository.getByBookAndChapterNo(payload.bookId, payload.chapterNo);

            if (!chapterBeforeCommit) {
              throw new Error(`Chapter not found: book=${payload.bookId}, chapter=${payload.chapterNo}`);
            }

            // 重新读取并校验 current_* pointer，避免在模型生成期间别的操作已经切换了 plan/draft/review。
            // 一旦 pointer 漂移，这次 approve 就不应继续提交到旧上下文之上。
            assertChapterPointersUnchanged(chapterBeforeCommit, {
              currentPlanId: chapter.current_plan_id,
              currentDraftId: chapter.current_draft_id,
              currentReviewId: chapter.current_review_id,
            });

            for (const item of diff.newCharacters) {
              // 这里先按同书同名复用已有人物，而不是每次 approve 都机械插入新记录。
              // 否则同名人物会在设定库里越积越多，后续 retrieval 反而更容易漂移。
              const existing = await trx
                .selectFrom("characters")
                .select(["id", "append_notes"])
                .where("book_id", "=", payload.bookId)
                .where("name", "=", item.name)
                .executeTakeFirst();

              if (existing) {
                createdEntities.characters.push(existing.id);
                await characterRepository.updateById(existing.id, {
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.summary),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await characterRepository.create({
                book_id: payload.bookId,
                name: item.name,
                alias: null,
                gender: null,
                age: null,
                personality: null,
                background: item.summary,
                current_location: null,
                status: "unknown",
                professions: null,
                levels: null,
                currencies: null,
                abilities: null,
                goal: null,
                append_notes: appendChapterNote(null, payload.chapterNo, item.summary),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.characters.push(created.id);
            }

            for (const item of diff.newFactions) {
              const existing = await trx
                .selectFrom("factions")
                .select(["id", "append_notes"])
                .where("book_id", "=", payload.bookId)
                .where("name", "=", item.name)
                .executeTakeFirst();

              if (existing) {
                createdEntities.factions.push(existing.id);
                await factionRepository.updateById(existing.id, {
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.summary),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await factionRepository.create({
                book_id: payload.bookId,
                name: item.name,
                category: null,
                core_goal: item.summary,
                description: item.summary,
                leader_character_id: null,
                headquarter: null,
                status: "active",
                append_notes: appendChapterNote(null, payload.chapterNo, item.summary),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.factions.push(created.id);
            }

            for (const item of diff.newItems) {
              const existing = await trx
                .selectFrom("items")
                .select(["id", "append_notes"])
                .where("book_id", "=", payload.bookId)
                .where("name", "=", item.name)
                .executeTakeFirst();

              if (existing) {
                createdEntities.items.push(existing.id);
                await itemRepository.updateById(existing.id, {
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.summary),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await itemRepository.create({
                book_id: payload.bookId,
                name: item.name,
                category: null,
                description: item.summary,
                owner_type: "none",
                owner_id: null,
                rarity: null,
                status: "active",
                append_notes: appendChapterNote(null, payload.chapterNo, item.summary),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.items.push(created.id);
            }

            for (const item of diff.newHooks) {
              const existing = await trx
                .selectFrom("story_hooks")
                .select(["id", "append_notes"])
                .where("book_id", "=", payload.bookId)
                .where("title", "=", item.title)
                .executeTakeFirst();

              if (existing) {
                createdEntities.hooks.push(existing.id);
                await hookRepository.updateById(existing.id, {
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.description),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await hookRepository.create({
                book_id: payload.bookId,
                title: item.title,
                hook_type: "mystery",
                description: item.description,
                source_chapter_no: payload.chapterNo,
                target_chapter_no: null,
                status: "open",
                importance: "medium",
                append_notes: appendChapterNote(null, payload.chapterNo, item.description),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.hooks.push(created.id);
            }

            for (const item of diff.newWorldSettings) {
              const existing = await trx
                .selectFrom("world_settings")
                .select(["id", "append_notes"])
                .where("book_id", "=", payload.bookId)
                .where("title", "=", item.title)
                .executeTakeFirst();

              if (existing) {
                createdEntities.worldSettings.push(existing.id);
                await worldSettingRepository.updateById(existing.id, {
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.content),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await worldSettingRepository.create({
                book_id: payload.bookId,
                title: item.title,
                category: item.category,
                content: item.content,
                status: "active",
                append_notes: appendChapterNote(null, payload.chapterNo, item.content),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.worldSettings.push(created.id);
            }

            for (const item of diff.newRelations) {
              // 关系没有简单的名称键，所以复用逻辑走 source/target/relationType 这组复合身份。
              // 这样 approve 多次运行时会倾向于更新同一条关系，而不是裂变出多条近似关系记录。
              const existing = await relationRepository.findByComposite({
                bookId: payload.bookId,
                sourceType: item.sourceType,
                sourceId: item.sourceId,
                targetType: item.targetType,
                targetId: item.targetId,
                relationType: item.relationType,
              });

              if (existing) {
                createdEntities.relations.push(existing.id);
                await relationRepository.updateById(existing.id, {
                  intensity: item.intensity ?? existing.intensity,
                  status: item.status ?? existing.status,
                  description: item.description,
                  keywords: JSON.stringify(item.keywords),
                  append_notes: appendChapterNote(existing.append_notes, payload.chapterNo, item.description),
                  updated_at: timestamp,
                });
                continue;
              }

              const created = await relationRepository.create({
                book_id: payload.bookId,
                source_type: item.sourceType,
                source_id: item.sourceId,
                target_type: item.targetType,
                target_id: item.targetId,
                relation_type: item.relationType,
                intensity: item.intensity ?? null,
                status: item.status ?? "active",
                description: item.description,
                append_notes: appendChapterNote(null, payload.chapterNo, item.description),
                keywords: JSON.stringify(item.keywords),
                created_at: timestamp,
                updated_at: timestamp,
              });
              createdEntities.relations.push(created.id);
            }

            let updatedCount = 0;
            const skippedUpdates: Array<{ entityType: string; entityId: number; reason: string }> = [];
            for (const update of diff.updates) {
              // diff 允许模型引用已经不存在的实体；这里选择静默跳过，
              // 目的是让 approve 能尽量提交其余稳定部分，而不是因为一条脏引用导致整批更新报废。
              if (update.entityType === "character") {
                const existing = await characterRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await characterRepository.updateById(update.entityId, mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp));
              }

              if (update.entityType === "faction") {
                const existing = await factionRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await factionRepository.updateById(update.entityId, mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp));
              }

              if (update.entityType === "item") {
                const existing = await itemRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await itemRepository.updateById(update.entityId, mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp));
              }

              if (update.entityType === "relation") {
                const existing = await relationRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await relationRepository.updateById(
                  update.entityId,
                  mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp),
                );
              }

              if (update.entityType === "story_hook") {
                const existing = await hookRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await hookRepository.updateById(update.entityId, mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp));
              }

              if (update.entityType === "world_setting") {
                const existing = await worldSettingRepository.getById(update.entityId);
                if (!existing) {
                  skippedUpdates.push({ entityType: update.entityType, entityId: update.entityId, reason: "entity_not_found" });
                  continue;
                }
                updatedCount += 1;
                await worldSettingRepository.updateById(update.entityId, mapEntityUpdate(existing, update.action, update.payload, payload.chapterNo, timestamp));
              }
            }

            if (skippedUpdates.length > 0) {
              this.logger.warn(
                {
                  event: "workflow.approve.skipped_updates",
                  bookId: payload.bookId,
                  chapterNo: payload.chapterNo,
                  skippedCount: skippedUpdates.length,
                  skippedUpdates,
                },
                "Approve skipped updates due to missing entity references",
              );
            }

            const finalDraft = await chapterDraftRepository.getById(chapterBeforeCommit.current_draft_id!);
            if (!finalDraft || finalDraft.chapter_id !== chapterBeforeCommit.id || finalDraft.book_id !== payload.bookId) {
              throw new Error("Current draft pointer is invalid");
            }

            const versionNo = (await chapterFinalRepository.getLatestVersionNo(chapterBeforeCommit.id)) + 1;
            const finalRecord = await chapterFinalRepository.create({
              book_id: payload.bookId,
              chapter_id: chapterBeforeCommit.id,
              chapter_no: payload.chapterNo,
              version_no: versionNo,
              based_on_draft_id: finalDraft.id,
              status: "active",
              content: finalResponse.content,
              summary: diff.chapterSummary,
              word_count: finalWordCount,
              source_type: CHAPTER_SOURCE_TYPE.APPROVED,
              created_at: timestamp,
              updated_at: timestamp,
            });

            const actualCharacterIds = dedupeNumberList([
              ...diff.actualCharacterIds,
              ...createdEntities.characters,
            ]);
            const actualFactionIds = dedupeNumberList([
              ...diff.actualFactionIds,
              ...createdEntities.factions,
            ]);
            const actualItemIds = dedupeNumberList([
              ...diff.actualItemIds,
              ...createdEntities.items,
            ]);
            const actualHookIds = dedupeNumberList([
              ...diff.actualHookIds,
              ...createdEntities.hooks,
            ]);
            const actualWorldSettingIds = dedupeNumberList([
              ...diff.actualWorldSettingIds,
              ...createdEntities.worldSettings,
            ]);
            const participantEntityRefs = buildStoryEventParticipantRefs({
              actualCharacterIds,
              actualFactionIds,
              actualItemIds,
              actualHookIds,
              actualWorldSettingIds,
            });

            const updatedChapter = await chapterRepository.updateByBookAndChapterNo(
              payload.bookId,
              payload.chapterNo,
              {
                current_final_id: finalRecord.id,
                title: chapterBeforeCommit.title,
                summary: diff.chapterSummary,
                word_count: finalWordCount,
                actual_character_ids: JSON.stringify(actualCharacterIds),
                actual_faction_ids: JSON.stringify(actualFactionIds),
                actual_item_ids: JSON.stringify(actualItemIds),
                actual_hook_ids: JSON.stringify(actualHookIds),
                actual_world_setting_ids: JSON.stringify(actualWorldSettingIds),
                status: CHAPTER_STATUS.APPROVED,
                updated_at: timestamp,
              },
            );

            if (!updatedChapter) {
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

            await clearApproveSidecarArtifacts({
              trx,
              bookId: payload.bookId,
              chapterId: chapterBeforeCommit.id,
              chapterNo: payload.chapterNo,
            });

            const approvedStoryEvent = await storyEventRepository.create({
              book_id: payload.bookId,
              chapter_id: chapterBeforeCommit.id,
              chapter_no: payload.chapterNo,
              event_type: "chapter_approval",
              title: `第${payload.chapterNo}章定稿事件`,
              summary: diff.chapterSummary,
              participant_entity_refs: JSON.stringify(participantEntityRefs),
              location_label: null,
              trigger_text: `approve:${finalRecord.id}`,
              outcome_text: diff.chapterSummary,
              unresolved_impact: diff.unresolvedImpact,
              hook_refs: JSON.stringify(actualHookIds),
              status: "active",
              created_at: timestamp,
              updated_at: timestamp,
            });

            const approvedSegment = await chapterSegmentRepository.create({
              book_id: payload.bookId,
              chapter_id: chapterBeforeCommit.id,
              chapter_no: payload.chapterNo,
              segment_index: 0,
              source_type: CHAPTER_SOURCE_TYPE.APPROVED,
              text: finalResponse.content,
              summary: diff.chapterSummary,
              event_refs: JSON.stringify([approvedStoryEvent.id]),
              metadata: JSON.stringify({
                finalId: finalRecord.id,
                wordCount: finalWordCount,
              }),
              status: "active",
              created_at: timestamp,
              updated_at: timestamp,
            });

            await retrievalDocumentRepository.create({
              book_id: payload.bookId,
              entity_type: "story_event",
              entity_id: approvedStoryEvent.id,
              layer: "event",
              chunk_key: `story_event:${payload.bookId}:${chapterBeforeCommit.id}:approved`,
              chapter_no: payload.chapterNo,
              payload_json: JSON.stringify({
                chapterId: chapterBeforeCommit.id,
                storyEventId: approvedStoryEvent.id,
                participantEntityRefs: participantEntityRefs,
                participantEntityRefGroups: {
                  characters: actualCharacterIds,
                  factions: actualFactionIds,
                  items: actualItemIds,
                  hooks: actualHookIds,
                  worldSettings: actualWorldSettingIds,
                },
                unresolvedImpact: diff.unresolvedImpact,
              }),
              text: diff.unresolvedImpact
                ? `${diff.chapterSummary}\n未收束影响：${diff.unresolvedImpact}`
                : diff.chapterSummary,
              embedding_model: null,
              embedding_vector_ref: null,
              status: "active",
              created_at: timestamp,
              updated_at: timestamp,
            });

            await retrievalDocumentRepository.create({
              book_id: payload.bookId,
              entity_type: "chapter",
              entity_id: approvedSegment.id,
              layer: "chapter_segment",
              chunk_key: `chapter_segment:${payload.bookId}:${chapterBeforeCommit.id}:0:approved`,
              chapter_no: payload.chapterNo,
              payload_json: JSON.stringify({
                chapterId: chapterBeforeCommit.id,
                segmentId: approvedSegment.id,
                sourceType: CHAPTER_SOURCE_TYPE.APPROVED,
                eventRefs: [approvedStoryEvent.id],
              }),
              text: finalResponse.content,
              embedding_model: null,
              embedding_vector_ref: null,
              status: "active",
              created_at: timestamp,
              updated_at: timestamp,
            });

            await persistApproveRetrievalFacts({
              repository: retrievalFactRepository,
              bookId: payload.bookId,
              chapterId: chapterBeforeCommit.id,
              chapterNo: payload.chapterNo,
              finalId: finalRecord.id,
              storyEventId: approvedStoryEvent.id,
              chapterSegmentId: approvedSegment.id,
              chapterSummary: diff.chapterSummary,
              updates: diff.updates,
              actualCharacterIds,
              actualFactionIds,
              actualItemIds,
              actualHookIds,
              actualWorldSettingIds,
              timestamp,
            });

            return {
              chapterId: chapter.id,
              finalId: finalRecord.id,
              finalContent: finalResponse.content,
              diff,
              createdEntities,
              updatedCount,
            };
          });
        },
      );
    } finally {
      await manager.destroy();
    }
  }
}

async function clearApproveSidecarArtifacts(input: {
  trx: Kysely<DatabaseSchema>;
  bookId: number;
  chapterId: number;
  chapterNo: number;
}): Promise<void> {
  await input.trx
    .deleteFrom("retrieval_documents")
    .where("book_id", "=", input.bookId)
    .where((expressionBuilder) =>
      expressionBuilder.or([
        expressionBuilder("chunk_key", "=", `story_event:${input.bookId}:${input.chapterId}:approved`),
        expressionBuilder("chunk_key", "=", `chapter_segment:${input.bookId}:${input.chapterId}:0:approved`),
      ]),
    )
    .executeTakeFirst();

  await input.trx.deleteFrom("story_events").where("book_id", "=", input.bookId).where("chapter_id", "=", input.chapterId).executeTakeFirst();
  await input.trx.deleteFrom("chapter_segments").where("book_id", "=", input.bookId).where("chapter_id", "=", input.chapterId).executeTakeFirst();
  await input.trx.deleteFrom("retrieval_facts").where("book_id", "=", input.bookId).where("chapter_no", "=", input.chapterNo).executeTakeFirst();
}

async function persistApproveRetrievalFacts(input: {
  repository: RetrievalFactRepository;
  bookId: number;
  chapterId: number;
  chapterNo: number;
  finalId: number;
  storyEventId: number;
  chapterSegmentId: number;
  chapterSummary: string;
  updates: z.infer<typeof approveDiffSchema>["updates"];
  actualCharacterIds: number[];
  actualFactionIds: number[];
  actualItemIds: number[];
  actualHookIds: number[];
  actualWorldSettingIds: number[];
  timestamp: string;
}): Promise<void> {
  await input.repository.create({
    book_id: input.bookId,
    chapter_no: input.chapterNo,
    entity_type: null,
    entity_id: null,
    event_id: input.storyEventId,
    fact_type: "chapter_summary",
    fact_key: `chapter:${input.bookId}:${input.chapterId}:summary`,
    fact_text: input.chapterSummary,
    payload_json: JSON.stringify({
      finalId: input.finalId,
      chapterSegmentId: input.chapterSegmentId,
      actualEntityRefs: {
        characters: input.actualCharacterIds,
        factions: input.actualFactionIds,
        items: input.actualItemIds,
        hooks: input.actualHookIds,
        worldSettings: input.actualWorldSettingIds,
      },
    }),
    importance: 90,
    risk_level: 70,
    effective_from_chapter_no: input.chapterNo,
    effective_to_chapter_no: null,
    superseded_by_fact_id: null,
    status: "active",
    created_at: input.timestamp,
    updated_at: input.timestamp,
  });

  for (const update of input.updates) {
    const note = buildUpdateFactText(update);
    if (!note) {
      continue;
    }

    await input.repository.create({
      book_id: input.bookId,
      chapter_no: input.chapterNo,
      entity_type: normalizeFactEntityType(update.entityType),
      entity_id: update.entityId,
      event_id: input.storyEventId,
      fact_type: `${normalizeFactEntityType(update.entityType)}_update`,
      fact_key: `${normalizeFactEntityType(update.entityType)}:${update.entityId}:chapter_update:${input.chapterNo}`,
      fact_text: note,
      payload_json: JSON.stringify({
        action: update.action,
        payload: update.payload,
      }),
      importance: 75,
      risk_level: 65,
      effective_from_chapter_no: input.chapterNo,
      effective_to_chapter_no: null,
      superseded_by_fact_id: null,
      status: "active",
      created_at: input.timestamp,
      updated_at: input.timestamp,
    });
  }
}

function buildUpdateFactText(update: z.infer<typeof approveDiffSchema>["updates"][number]): string | null {
  const parts: string[] = [];
  const directNote =
    typeof update.payload.note === "string" ? update.payload.note
      : typeof update.payload.append_notes === "string" ? update.payload.append_notes
      : typeof update.payload.description === "string" ? update.payload.description
      : null;

  if (typeof directNote === "string" && directNote.trim().length > 0) {
    parts.push(directNote.trim());
  }

  if (typeof update.payload.status === "string" && update.payload.status.trim().length > 0) {
    parts.push(`状态变更为：${update.payload.status.trim()}`);
  }

  if (typeof update.payload.current_location === "string" && update.payload.current_location.trim().length > 0) {
    parts.push(`当前位置变更为：${update.payload.current_location.trim()}`);
  }

  if (typeof update.payload.goal === "string" && update.payload.goal.trim().length > 0) {
    parts.push(`目标变更为：${update.payload.goal.trim()}`);
  }

  if (typeof update.payload.content === "string" && update.payload.content.trim().length > 0) {
    parts.push(`内容更新：${update.payload.content.trim()}`);
  }

  if (typeof update.payload.core_goal === "string" && update.payload.core_goal.trim().length > 0) {
    parts.push(`核心目标变更为：${update.payload.core_goal.trim()}`);
  }

  if (typeof update.payload.owner_type === "string" || typeof update.payload.owner_id === "number") {
    const ownerType = typeof update.payload.owner_type === "string" ? update.payload.owner_type : "unknown";
    const ownerId = typeof update.payload.owner_id === "number" ? update.payload.owner_id : null;
    parts.push(ownerId === null ? `归属类型变更为：${ownerType}` : `归属变更为：${ownerType}#${ownerId}`);
  }

  if (typeof update.payload.leader_character_id === "number") {
    parts.push(`首领角色变更为：character#${update.payload.leader_character_id}`);
  }

  if (typeof update.payload.intensity === "number") {
    parts.push(`关系强度调整为：${update.payload.intensity}`);
  }

  const consumedKeys = new Set([
    "note",
    "append_notes",
    "description",
    "status",
    "current_location",
    "goal",
    "content",
    "core_goal",
    "owner_type",
    "owner_id",
    "leader_character_id",
    "intensity",
  ]);
  for (const [key, value] of Object.entries(update.payload)) {
    if (consumedKeys.has(key)) {
      continue;
    }
    const rendered = renderUpdateFactValue(value);
    if (!rendered) {
      continue;
    }
    parts.push(`${humanizeUpdateFactKey(key)}：${rendered}`);
    if (parts.length >= 4) {
      break;
    }
  }

  const uniqueParts = Array.from(new Set(parts.map((item) => item.trim()).filter((item) => item.length > 0)));
  if (uniqueParts.length === 0) {
    return null;
  }

  return uniqueParts.join("；");
}

function normalizeFactEntityType(entityType: z.infer<typeof approveDiffSchema>["updates"][number]["entityType"]): string {
  return entityType === "story_hook" ? "hook" : entityType;
}

function mapEntityUpdate<T extends { append_notes?: string | null; status?: string | null }>(
  existing: T,
  action: "update_fields" | "append_notes" | "status_change",
  payload: Record<string, unknown>,
  chapterNo: number,
  timestamp: string,
): Record<string, unknown> {
  // update action 先被压成统一语义，再映射到各 repository 的 update payload。
  // 这样 approve diff 只需要表达“想做什么”，而不用感知每张表的具体字段组合差异。
  if (action === "append_notes") {
    return {
      append_notes: appendChapterNote(existing.append_notes ?? null, chapterNo, String(payload.note ?? payload.append_notes ?? "")),
      updated_at: timestamp,
    };
  }

  if (action === "status_change") {
    return {
      status: typeof payload.status === "string" ? payload.status : existing.status,
      append_notes:
        payload.note || payload.append_notes
          ? appendChapterNote(existing.append_notes ?? null, chapterNo, String(payload.note ?? payload.append_notes))
          : existing.append_notes,
      updated_at: timestamp,
    };
  }

  return {
    ...payload,
    updated_at: timestamp,
  };
}

function normalizeApproveDiff(input: z.infer<typeof approveDiffLooseSchema>): z.infer<typeof approveDiffSchema> {
  // 模型返回的 diff 允许字段名、数字类型、局部结构有轻微漂移；
  // 这里先做“宽进严出”的归一化，再交给严格 schema 兜底，减少因为格式小偏差导致 approve 整体失败。
  return {
    chapterSummary: input.chapterSummary.trim(),
    unresolvedImpact: pickNullableString(input as Record<string, unknown>, ["unresolvedImpact", "unresolved_impact"]),
    actualCharacterIds: normalizeNumberList(input.actualCharacterIds),
    actualFactionIds: normalizeNumberList(input.actualFactionIds),
    actualItemIds: normalizeNumberList(input.actualItemIds),
    actualHookIds: normalizeNumberList(input.actualHookIds),
    actualWorldSettingIds: normalizeNumberList(input.actualWorldSettingIds),
    newCharacters: input.newCharacters.map(normalizeNamedSummaryEntity).filter(isTruthy),
    newFactions: input.newFactions.map(normalizeNamedSummaryEntity).filter(isTruthy),
    newItems: input.newItems.map(normalizeNamedSummaryEntity).filter(isTruthy),
    newHooks: input.newHooks.map(normalizeHookEntity).filter(isTruthy),
    newWorldSettings: input.newWorldSettings.map(normalizeWorldSettingEntity).filter(isTruthy),
    newRelations: input.newRelations.map(normalizeRelationEntity).filter(isTruthy),
    updates: input.updates.map(normalizeUpdateEntity).filter(isTruthy),
  };
}

function normalizeNumberList(items: Array<number | string>): number[] {
  return items
    .map((item) => (typeof item === "number" ? item : Number.parseInt(item, 10)))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeNamedSummaryEntity(item: Record<string, unknown>) {
  const name = pickString(item, ["name", "title"]);
  const summary = pickString(item, ["summary", "description", "content", "note"]);

  if (!name || !summary) {
    return null;
  }

  return {
    name,
    summary,
    keywords: normalizeKeywords(item.keywords),
  };
}

function normalizeHookEntity(item: Record<string, unknown>) {
  const title = pickString(item, ["title", "name", "hookTitle"]);
  const description = pickString(item, ["description", "summary", "content", "note"]);

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    keywords: normalizeKeywords(item.keywords),
  };
}

function normalizeWorldSettingEntity(item: Record<string, unknown>) {
  const title = pickString(item, ["title", "name"]);
  const category = pickString(item, ["category", "type"]) ?? "补充设定";
  const content = pickString(item, ["content", "summary", "description", "note"]);

  if (!title || !content) {
    return null;
  }

  return {
    title,
    category,
    content,
    keywords: normalizeKeywords(item.keywords),
  };
}

function normalizeRelationEntity(item: Record<string, unknown>) {
  const sourceType = pickEnum(item, ["sourceType", "source_type"], ["character", "faction"]);
  const sourceId = pickNumber(item, ["sourceId", "source_id"]);
  const targetType = pickEnum(item, ["targetType", "target_type"], ["character", "faction"]);
  const targetId = pickNumber(item, ["targetId", "target_id"]);
  const relationType = pickString(item, ["relationType", "relation_type"]);
  const description = pickString(item, ["description", "summary", "note"]);

  if (!sourceType || !sourceId || !targetType || !targetId || !relationType || !description) {
    return null;
  }

  return {
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationType,
    intensity: pickNullableNumber(item, ["intensity"]),
    status: pickString(item, ["status"]),
    description,
    keywords: normalizeKeywords(item.keywords),
  };
}

function normalizeUpdateEntity(item: Record<string, unknown>) {
  const entityType = pickEnum(
    item,
    ["entityType", "entity_type"],
    ["character", "faction", "relation", "item", "story_hook", "world_setting"],
  );
  const entityId = pickNumber(item, ["entityId", "entity_id"]);
  const action = pickEnum(item, ["action"], ["update_fields", "append_notes", "status_change"]);

  if (!entityType || !entityId || !action) {
    return null;
  }

  const payload =
    item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : buildUpdatePayload(action, item);

  return {
    entityType,
    entityId,
    action,
    payload,
  };
}

function buildUpdatePayload(action: "update_fields" | "append_notes" | "status_change", item: Record<string, unknown>) {
  // 有些模型会把更新字段平铺在顶层，有些会放进 payload / fields；
  // 这里统一折叠成内部 update payload，尽量吸收输出风格差异而不是把格式要求全推给 prompt。
  if (action === "append_notes") {
    return { note: pickString(item, ["note", "append_notes", "description", "summary"]) ?? "" };
  }

  if (action === "status_change") {
    return {
      status: pickString(item, ["status"]),
      note: pickString(item, ["note", "append_notes", "description", "summary"]),
    };
  }

  if (item.fields && typeof item.fields === "object") {
    return item.fields as Record<string, unknown>;
  }

  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !["entityType", "entity_type", "entityId", "entity_id", "action"].includes(key)),
  );
}

function pickString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function pickNullableNumber(item: Record<string, unknown>, keys: string[]): number | null | undefined {
  for (const key of keys) {
    const value = item[key];
    if (value == null || value === "") {
      return null;
    }
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function pickEnum<T extends string>(item: Record<string, unknown>, keys: string[], allowed: T[]): T | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && allowed.includes(value as T)) {
      return value as T;
    }
  }

  return null;
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isTruthy<T>(value: T | null): value is T {
  return value !== null;
}

function buildStoryEventParticipantRefs(input: {
  actualCharacterIds: number[];
  actualFactionIds: number[];
  actualItemIds: number[];
  actualHookIds: number[];
  actualWorldSettingIds: number[];
}): Array<{ entityType: string; entityId: number }> {
  return [
    ...input.actualCharacterIds.map((entityId) => ({ entityType: "character", entityId })),
    ...input.actualFactionIds.map((entityId) => ({ entityType: "faction", entityId })),
    ...input.actualItemIds.map((entityId) => ({ entityType: "item", entityId })),
    ...input.actualHookIds.map((entityId) => ({ entityType: "hook", entityId })),
    ...input.actualWorldSettingIds.map((entityId) => ({ entityType: "world_setting", entityId })),
  ];
}

function humanizeUpdateFactKey(key: string): string {
  const dictionary: Record<string, string> = {
    category: "类别",
    relation_type: "关系类型",
    source_type: "来源类型",
    target_type: "目标类型",
    source_id: "来源ID",
    target_id: "目标ID",
    keywords: "关键词",
    title: "标题",
    name: "名称",
    status_note: "状态说明",
  };
  return dictionary[key] ?? key.replace(/_/g, " ");
}

function renderUpdateFactValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value.trim() : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const rendered = value.map((item) => renderUpdateFactValue(item)).filter((item): item is string => Boolean(item)).join(", ");
    return rendered.length > 0 ? rendered : null;
  }
  if (value && typeof value === "object") {
    const compact = JSON.stringify(value);
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }
  return null;
}

function pickNullableString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
