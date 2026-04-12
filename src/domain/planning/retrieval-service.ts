import { env } from "../../config/env.js";
import type { AppLogger } from "../../core/logger/index.js";
import { executeDbAction } from "../shared/service-helpers.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import {
  buildReasons,
  proximityBoost,
  rankRows,
  scoreEntity,
  type RetrievalScoredRow,
} from "./retrieval-ranking.js";
import { buildRecentChanges } from "./recent-changes.js";
import { buildPriorityContext } from "./retrieval-facts.js";
import { EmbeddingCandidateProvider, type EmbeddingCandidateSearcher } from "./embedding-candidate-provider.js";
import { HeuristicReranker } from "./retrieval-reranker-heuristic.js";

import type {
  ManualEntityRefs,
  PlanRetrievedContext,
  PlanRetrievedContextEntityGroups,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
} from "./types.js";
import {
  DirectPassThroughReranker,
  type RetrievalCandidateBundle,
  type RetrievalCandidateProvider,
  type RetrievalReranker,
  type RetrievePlanContextParams,
} from "./retrieval-pipeline.js";

const KEYWORD_LIMITS = {
  outlines: env.PLANNING_RETRIEVAL_OUTLINE_LIMIT,
  recentChapters: env.PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT,
  hooks: env.PLANNING_RETRIEVAL_HOOK_LIMIT,
  characters: env.PLANNING_RETRIEVAL_CHARACTER_LIMIT,
  factions: env.PLANNING_RETRIEVAL_FACTION_LIMIT,
  items: env.PLANNING_RETRIEVAL_ITEM_LIMIT,
  relations: env.PLANNING_RETRIEVAL_RELATION_LIMIT,
  worldSettings: env.PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT,
} as const;

const ENTITY_SCAN_LIMIT = env.PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT;
// 实体类召回会先扫一批候选，再做打分与截断；
// 因此 scan limit 决定的是“候选池大小”，不是最终塞进 prompt 的条数。
const RECENT_CHAPTER_SCAN_LIMIT =
  env.PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT * env.PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER;

export class RetrievalQueryService {
  private readonly candidateProvider: RetrievalCandidateProvider;

  private readonly reranker: RetrievalReranker;

  constructor(
    private readonly logger: AppLogger,
    options?: {
      candidateProvider?: RetrievalCandidateProvider;
      reranker?: RetrievalReranker;
      embeddingSearcher?: EmbeddingCandidateSearcher;
      embeddingSearchMode?: "basic" | "hybrid";
    },
  ) {
    const baseProvider = options?.candidateProvider ?? new RuleBasedCandidateProvider();
    const embeddingSearchMode = options?.embeddingSearchMode ?? env.PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE;
    const shouldEnableEmbedding = env.PLANNING_RETRIEVAL_EMBEDDING_ENABLED && options?.embeddingSearcher;

    this.candidateProvider = shouldEnableEmbedding
      ? new EmbeddingCandidateProvider(baseProvider, options.embeddingSearcher!, {
          limit: embeddingSearchMode === "hybrid" ? 12 : 10,
        })
      : baseProvider;
    this.reranker = options?.reranker ?? createConfiguredReranker();
  }

  // 这里产出的不是只给 plan 自己看的临时检索结果，
  // 而是会被固化进 chapter_plans.retrieved_context、并被后续 draft/review/repair/approve 复用的共享上下文。
  async retrievePlanContext(params: RetrievePlanContextParams): Promise<PlanRetrievedContext> {
    return executeDbAction(
      this.logger,
      {
        event: "planning.retrieve",
        entityType: "plan_context",
        bookId: params.bookId,
        chapterNo: params.chapterNo,
      },
      async (db) => {
        const book = await db
          .selectFrom("books")
          .selectAll()
          .where("id", "=", params.bookId)
          .executeTakeFirst();

        if (!book) {
          throw new Error(`Book not found: ${params.bookId}`);
        }

        const candidates = await this.candidateProvider.loadCandidates(db, params);
        const reranked = await this.reranker.rerank({
          params,
          candidates,
        });

        const outlines = reranked.outlines;
        const recentChapters = reranked.recentChapters;
        const entityGroups = reranked.entityGroups;
        const { hooks, characters, factions, items, relations, worldSettings } = entityGroups;

        const hardConstraints = buildHardConstraints(entityGroups);
        const riskReminders = buildRiskReminders({
          hardConstraints,
          recentChapters,
        });
        const priorityContext = buildPriorityContext({
          hardConstraints,
          softReferences: entityGroups,
        });
        const recentChanges = buildRecentChanges({
          recentChapters,
          riskReminders,
          entities: [
            ...hardConstraints.characters,
            ...hardConstraints.items,
            ...hardConstraints.relations,
            ...hardConstraints.hooks,
            ...hardConstraints.worldSettings,
          ],
        });

        return {
          book: {
            id: book.id,
            title: book.title,
            summary: book.summary,
            targetChapterCount: book.target_chapter_count,
            currentChapterCount: book.current_chapter_count,
          },
          outlines,
          recentChapters,
          // 兼容层：保留旧顶层字段，避免现有工作流、测试和历史导入逻辑一次性全部被打断。
          hooks,
          characters,
          factions,
          items,
          relations,
          worldSettings,
          // V2 开始把召回内容显式拆成“硬约束”和“软参考”：
          // 硬约束优先承载容易写错、且一旦出错会破坏连续性的实体信息；
          // 软参考则保留更完整的召回结果，供不同阶段视图继续裁剪。
          hardConstraints,
          softReferences: {
            outlines,
            recentChapters,
            entities: entityGroups,
          },
          priorityContext,
          recentChanges,
          // riskReminders 是面向后续 prompt 的补充提醒，
          // 用来显式提示未回收钩子、章节连续性风险等信息，但它本身不参与实体打分排序。
          riskReminders,
        };
      },
    );
  }

}

function createConfiguredReranker(): RetrievalReranker {
  switch (env.PLANNING_RETRIEVAL_RERANKER) {
    case "heuristic":
      return new HeuristicReranker();
    case "none":
    default:
      return new DirectPassThroughReranker();
  }
}

class RuleBasedCandidateProvider implements RetrievalCandidateProvider {
  async loadCandidates(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievalCandidateBundle> {
    const outlines = await this.loadOutlines(db, params.bookId, params.chapterNo);
    const recentChapters = await this.loadRecentChapters(db, params.bookId, params.chapterNo);
    const characters = await this.loadCharacters(db, params);
    const factions = await this.loadFactions(db, params);
    const items = await this.loadItems(db, params);
    const hooks = await this.loadHooks(db, params);
    const relations = await this.loadRelations(db, params);
    const worldSettings = await this.loadWorldSettings(db, params);

    return {
      outlines,
      recentChapters,
      entityGroups: {
        hooks,
        characters,
        factions,
        items,
        relations,
        worldSettings,
      },
    };
  }

  private async loadOutlines(
    db: import("kysely").Kysely<DatabaseSchema>,
    bookId: number,
    chapterNo: number,
  ): Promise<RetrievedOutline[]> {
    const rows = await db
      .selectFrom("outlines")
      .selectAll()
      .where("book_id", "=", bookId)
      .where((expressionBuilder) =>
        expressionBuilder.or([
          expressionBuilder.and([
            expressionBuilder("chapter_start_no", "<=", chapterNo),
            expressionBuilder("chapter_end_no", ">=", chapterNo),
          ]),
          expressionBuilder("chapter_start_no", "is", null),
        ]),
      )
      .orderBy("chapter_start_no", "asc")
      .limit(KEYWORD_LIMITS.outlines)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      reason: "outline_hit",
      content: [
        `title=${row.title}`,
        row.story_core ? `story_core=${row.story_core}` : undefined,
        row.main_plot ? `main_plot=${row.main_plot}` : undefined,
        row.sub_plot ? `sub_plot=${row.sub_plot}` : undefined,
        row.foreshadowing ? `foreshadowing=${row.foreshadowing}` : undefined,
        row.expected_payoff ? `expected_payoff=${row.expected_payoff}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    }));
  }

  private async loadRecentChapters(
    db: import("kysely").Kysely<DatabaseSchema>,
    bookId: number,
    chapterNo: number,
  ): Promise<RetrievedChapterSummary[]> {
    const rows = await db
      .selectFrom("chapters")
      .select([
        "id",
        "chapter_no",
        "title",
        "summary",
        "status",
        "current_plan_id",
        "current_draft_id",
        "current_final_id",
      ])
      .where("book_id", "=", bookId)
      .where("chapter_no", "<", chapterNo)
      .where("status", "!=", "todo")
      .orderBy("chapter_no", "desc")
      .limit(RECENT_CHAPTER_SCAN_LIMIT)
      .execute();

    const planIds = rows
      .map((row) => row.current_plan_id)
      .filter((value): value is number => value !== null);
    const draftIds = rows
      .map((row) => row.current_draft_id)
      .filter((value): value is number => value !== null);
    const finalIds = rows
      .map((row) => row.current_final_id)
      .filter((value): value is number => value !== null);

    const [planRows, draftRows, finalRows] = await Promise.all([
      planIds.length > 0
        ? db
            .selectFrom("chapter_plans")
            .select(["id", "author_intent"])
            .where("id", "in", planIds)
            .execute()
        : Promise.resolve([]),
      draftIds.length > 0
        ? db
            .selectFrom("chapter_drafts")
            .select(["id", "summary"])
            .where("id", "in", draftIds)
            .execute()
        : Promise.resolve([]),
      finalIds.length > 0
        ? db
            .selectFrom("chapter_finals")
            .select(["id", "summary"])
            .where("id", "in", finalIds)
            .execute()
        : Promise.resolve([]),
    ]);

    const planSummaryMap = new Map(planRows.map((row) => [row.id, row.author_intent]));
    const draftSummaryMap = new Map(draftRows.map((row) => [row.id, row.summary]));
    const finalSummaryMap = new Map(finalRows.map((row) => [row.id, row.summary]));

    return rows
      .map((row) => ({
        id: row.id,
        chapterNo: row.chapter_no,
        title: row.title,
        summary:
          row.summary ??
          (row.current_final_id ? finalSummaryMap.get(row.current_final_id) ?? null : null) ??
          (row.current_draft_id ? draftSummaryMap.get(row.current_draft_id) ?? null : null) ??
          (row.current_plan_id ? planSummaryMap.get(row.current_plan_id) ?? null : null),
        status: row.status,
      }))
      .filter((row) => Boolean(row.summary?.trim()))
      .slice(0, KEYWORD_LIMITS.recentChapters);
  }

  private async loadCharacters(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("characters")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .where("status", "in", ["alive", "missing", "unknown"])
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        // 人物召回里，姓名/别名比长文本背景更容易决定“本章到底是不是在写这个人”，
        // 因此先提高 name/alias/goal/current_location 这类字段的权重。
        score: scoreEntity({
          manualIds: params.manualRefs.characterIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.name, weight: 35 },
            { text: row.alias, weight: 30 },
            { text: row.goal, weight: 28 },
            { text: row.current_location, weight: 26 },
            { text: row.background, weight: 18 },
            { text: row.personality, weight: 16 },
            { text: row.professions, weight: 12 },
            { text: row.levels, weight: 12 },
            { text: row.currencies, weight: 10 },
            { text: row.abilities, weight: 14 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.characterIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.name, weight: 35 },
            { text: row.alias, weight: 30 },
            { text: row.goal, weight: 28 },
            { text: row.current_location, weight: 26 },
            { text: row.background, weight: 18 },
            { text: row.personality, weight: 16 },
            { text: row.professions, weight: 12 },
            { text: row.levels, weight: 12 },
            { text: row.currencies, weight: 10 },
            { text: row.abilities, weight: 14 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
        }),
        content: compactLines([
          `name=${row.name}`,
          row.alias ? `alias=${row.alias}` : undefined,
          row.gender ? `gender=${row.gender}` : undefined,
          row.age !== null ? `age=${row.age}` : undefined,
          row.personality ? `personality=${row.personality}` : undefined,
          row.background ? `background=${row.background}` : undefined,
          row.current_location ? `current_location=${row.current_location}` : undefined,
          row.professions ? `professions=${row.professions}` : undefined,
          row.levels ? `levels=${row.levels}` : undefined,
          row.currencies ? `currencies=${row.currencies}` : undefined,
          row.abilities ? `abilities=${row.abilities}` : undefined,
          `status=${row.status}`,
          row.goal ? `goal=${row.goal}` : undefined,
          row.append_notes ? `append_notes=${row.append_notes}` : undefined,
        ]),
      })),
      KEYWORD_LIMITS.characters,
    );
  }

  private async loadFactions(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("factions")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        score: scoreEntity({
          manualIds: params.manualRefs.factionIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.name, weight: 34 },
            { text: row.category, weight: 22 },
            { text: row.core_goal, weight: 24 },
            { text: row.description, weight: 14 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
        }) + institutionalFactionBoost(row.category, params.keywords),
        reason: buildReasons({
          manualIds: params.manualRefs.factionIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.name, weight: 34 },
            { text: row.category, weight: 22 },
            { text: row.core_goal, weight: 24 },
            { text: row.description, weight: 14 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
          extraReasons: institutionalFactionBoost(row.category, params.keywords) > 0 ? ["institution_context"] : [],
        }),
        content: compactLines([
          `name=${row.name}`,
          row.category ? `category=${row.category}` : undefined,
          row.core_goal ? `core_goal=${row.core_goal}` : undefined,
          row.description ? `description=${row.description}` : undefined,
          row.leader_character_id ? `leader_character_id=${row.leader_character_id}` : undefined,
          row.headquarter ? `headquarter=${row.headquarter}` : undefined,
          row.status ? `status=${row.status}` : undefined,
          row.append_notes ? `append_notes=${row.append_notes}` : undefined,
        ]),
      })),
      KEYWORD_LIMITS.factions,
    );
  }

  

  private async loadItems(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("items")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        score: scoreEntity({
          manualIds: params.manualRefs.itemIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.name, row.description, row.append_notes, row.keywords],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.itemIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.name, row.description, row.append_notes, row.keywords],
        }),
        content: compactLines([
          `name=${row.name}`,
          row.category ? `category=${row.category}` : undefined,
          row.description ? `description=${row.description}` : undefined,
          `owner_type=${row.owner_type}`,
          row.owner_id ? `owner_id=${row.owner_id}` : undefined,
          row.rarity ? `rarity=${row.rarity}` : undefined,
          row.status ? `status=${row.status}` : undefined,
          row.append_notes ? `append_notes=${row.append_notes}` : undefined,
        ]),
      })),
      KEYWORD_LIMITS.items,
    );
  }

  private async loadHooks(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("story_hooks")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .where("status", "in", ["open", "progressing"])
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        score:
          scoreEntity({
            manualIds: params.manualRefs.hookIds,
            entityId: row.id,
            keywords: params.keywords,
            textSources: [row.title, row.description, row.append_notes, row.keywords],
          }) + proximityBoost(row.target_chapter_no, params.chapterNo),
        reason: buildReasons({
          manualIds: params.manualRefs.hookIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.title, row.description, row.append_notes, row.keywords],
          extraReasons: row.target_chapter_no && Math.abs(row.target_chapter_no - params.chapterNo) <= 2
            ? ["chapter_proximity"]
            : [],
        }),
        content: compactLines([
          `title=${row.title}`,
          row.hook_type ? `hook_type=${row.hook_type}` : undefined,
          `status=${row.status}`,
          row.source_chapter_no ? `source_chapter_no=${row.source_chapter_no}` : undefined,
          row.target_chapter_no ? `target_chapter_no=${row.target_chapter_no}` : undefined,
          row.description ? `description=${row.description}` : undefined,
          row.append_notes ? `append_notes=${row.append_notes}` : undefined,
        ]),
      })),
      KEYWORD_LIMITS.hooks,
    );
  }

  private async loadRelations(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("relations")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    const characterIds = rows.flatMap((row) => [
      row.source_type === "character" ? row.source_id : null,
      row.target_type === "character" ? row.target_id : null,
    ]).filter((value): value is number => value !== null);
    const factionIds = rows.flatMap((row) => [
      row.source_type === "faction" ? row.source_id : null,
      row.target_type === "faction" ? row.target_id : null,
    ]).filter((value): value is number => value !== null);

    const [characterRows, factionRows] = await Promise.all([
      characterIds.length > 0
        ? db
            .selectFrom("characters")
            .select(["id", "name"])
            .where("id", "in", [...new Set(characterIds)])
            .execute()
        : Promise.resolve([]),
      factionIds.length > 0
        ? db
            .selectFrom("factions")
            .select(["id", "name"])
            .where("id", "in", [...new Set(factionIds)])
            .execute()
        : Promise.resolve([]),
    ]);

    const characterNameMap = new Map(characterRows.map((row) => [row.id, row.name]));
    const factionNameMap = new Map(factionRows.map((row) => [row.id, row.name]));
    const manualEntityIds = new Set([
      ...params.manualRefs.characterIds,
      ...params.manualRefs.factionIds,
    ]);

    return rankRows(
      rows.map((row) => {
        const relatedToManualEntity =
          manualEntityIds.has(row.source_id) || manualEntityIds.has(row.target_id);
        const sourceLabel = resolveRelationEndpointName(
          row.source_type,
          row.source_id,
          characterNameMap,
          factionNameMap,
        );
        const targetLabel = resolveRelationEndpointName(
          row.target_type,
          row.target_id,
          characterNameMap,
          factionNameMap,
        );

        return {
          id: row.id,
          // 关系是否相关，优先看两端实体和 relationType，
          // 描述性长文本只作为补充命中来源。
          score:
            scoreEntity({
              manualIds: params.manualRefs.relationIds,
              entityId: row.id,
              keywords: params.keywords,
              weightedTextSources: [
                { text: sourceLabel, weight: 30 },
                { text: targetLabel, weight: 30 },
                { text: row.relation_type, weight: 26 },
                { text: row.description, weight: 14 },
                { text: row.append_notes, weight: 8 },
                { text: row.keywords, weight: 18 },
              ],
            }) + (relatedToManualEntity ? 35 : 0),
          reason: buildReasons({
            manualIds: params.manualRefs.relationIds,
            entityId: row.id,
            keywords: params.keywords,
            weightedTextSources: [
              { text: sourceLabel, weight: 30 },
              { text: targetLabel, weight: 30 },
              { text: row.relation_type, weight: 26 },
              { text: row.description, weight: 14 },
              { text: row.append_notes, weight: 8 },
              { text: row.keywords, weight: 18 },
            ],
            extraReasons: relatedToManualEntity ? ["manual_entity_link"] : [],
          }),
          content: compactLines([
            `source=${sourceLabel} (${row.source_type}:${row.source_id})`,
            `target=${targetLabel} (${row.target_type}:${row.target_id})`,
            `relation_type=${row.relation_type}`,
            row.status ? `status=${row.status}` : undefined,
            row.description ? `description=${row.description}` : undefined,
            row.append_notes ? `append_notes=${row.append_notes}` : undefined,
          ]),
        };
      }),
      KEYWORD_LIMITS.relations,
    );
  }

  private async loadWorldSettings(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    const rows = await db
      .selectFrom("world_settings")
      .selectAll()
      .where("book_id", "=", params.bookId)
      .where("status", "=", "active")
      .limit(ENTITY_SCAN_LIMIT)
      .execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        // 世界设定里 title/category 往往比长正文更能代表“当前这一章正在引用哪条规则”，
        // 因此优先提高它们的命中权重。
        score: scoreEntity({
          manualIds: params.manualRefs.worldSettingIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.title, weight: 34 },
            { text: row.category, weight: 28 },
            { text: row.content, weight: 16 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.worldSettingIds,
          entityId: row.id,
          keywords: params.keywords,
          weightedTextSources: [
            { text: row.title, weight: 34 },
            { text: row.category, weight: 28 },
            { text: row.content, weight: 16 },
            { text: row.append_notes, weight: 8 },
            { text: row.keywords, weight: 18 },
          ],
        }),
        content: compactLines([
          `title=${row.title}`,
          `category=${row.category}`,
          `content=${row.content}`,
          row.append_notes ? `append_notes=${row.append_notes}` : undefined,
        ]),
      })),
      KEYWORD_LIMITS.worldSettings,
    );
  }
}

function compactLines(lines: Array<string | undefined>): string {
  return lines.filter(Boolean).join("\n");
}

function resolveRelationEndpointName(
  entityType: string,
  entityId: number,
  characterNameMap: Map<number, string>,
  factionNameMap: Map<number, string>,
): string {
  if (entityType === "character") {
    return characterNameMap.get(entityId) ?? `character:${entityId}`;
  }

  if (entityType === "faction") {
    return factionNameMap.get(entityId) ?? `faction:${entityId}`;
  }

  return `${entityType}:${entityId}`;
}

function buildHardConstraints(groups: PlanRetrievedContextEntityGroups): PlanRetrievedContextEntityGroups {
  return {
    hooks: selectPriorityEntities(groups.hooks, 5, (entity) =>
      entity.reason.includes("chapter_proximity") || entity.reason.includes("manual_id"),
    ),
    // 人物如果是手工指定、关键词强命中，或文本里带当前位置/状态信息，优先进入硬约束。
    characters: selectPriorityEntities(groups.characters, 6, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.content.includes("current_location=") ||
      entity.content.includes("status=") ||
      entity.score >= 130,
    ),
    factions: selectPriorityEntities(groups.factions, 4, (entity) =>
      entity.reason.includes("manual_id") || entity.score >= 125,
    ),
    // 物品归属和状态最容易造成连续性错误，因此优先保留带 owner/status 信息的高分项。
    items: selectPriorityEntities(groups.items, 4, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.content.includes("owner_type=") ||
      entity.content.includes("status=") ||
      entity.score >= 125,
    ),
    relations: selectPriorityEntities(groups.relations, 6, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.reason.includes("manual_entity_link") ||
      entity.score >= 130,
    ),
    // 世界规则类内容即使不是最高分，只要是活跃规则也值得优先保留在硬约束层。
    worldSettings: selectPriorityEntities(groups.worldSettings, 4, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.content.includes("category=") ||
      entity.score >= 125,
    ),
  };
}

function selectPriorityEntities(
  entities: RetrievedEntity[],
  limit: number,
  isPriority: (entity: RetrievedEntity) => boolean,
): RetrievedEntity[] {
  const prioritized = entities.filter(isPriority);
  const fallback = entities.filter((entity) => !isPriority(entity));

  return [...prioritized, ...fallback].slice(0, limit);
}

function institutionalFactionBoost(category: string | null, keywords: string[]): number {
  const normalizedCategory = (category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const hasInstitutionalCue = normalizedKeywords.some((keyword) =>
    ["执事", "长老", "内门", "外门", "宗门", "入宗", "成员", "关系"].some((token) => keyword.includes(token)),
  );

  return hasInstitutionalCue ? 18 : 0;
}

function buildRiskReminders(input: {
  hardConstraints: PlanRetrievedContextEntityGroups;
  recentChapters: RetrievedChapterSummary[];
}): string[] {
  const reminders: string[] = [];

  if (input.hardConstraints.hooks.some((hook) => hook.reason.includes("chapter_proximity"))) {
    reminders.push("存在接近回收节点的重要钩子，正文中要么推进、要么明确交代，避免直接遗忘。");
  }

  if (input.recentChapters.length > 0) {
    reminders.push(`注意承接最近 ${input.recentChapters.length} 章的状态延续和人物位置变化。`);
  }

  if (input.hardConstraints.characters.some((character) => character.content.includes("current_location="))) {
    reminders.push("注意人物当前位置连续性，避免人物在没有过渡的情况下突然更换场景。");
  }

  if (
    input.hardConstraints.items.some((item) =>
      item.content.includes("owner_type=") ||
      item.content.includes("owner_id=") ||
      item.content.includes("status="),
    )
  ) {
    reminders.push("注意关键物品的持有者与状态连续性，避免无交代易主、失踪或突然恢复。");
  }

  if (input.hardConstraints.worldSettings.length > 0) {
    reminders.push("注意不要违反已激活的世界规则、职业体系、制度边界或货币体系。");
  }

  return [...new Set(reminders)];
}
