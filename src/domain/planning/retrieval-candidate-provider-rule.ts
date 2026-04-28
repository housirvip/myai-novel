import { env } from "../../config/env.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import {
  buildReasons,
  proximityBoost,
  rankRows,
  scoreEntity,
} from "./retrieval-ranking.js";
import {
  authorityReactionFactionBoost,
  continuityCharacterBoost,
  continuityItemBoost,
  crossEntityConflictCharacterBoost,
  crossEntityConflictFactionBoost,
  crossEntityConflictWorldSettingBoost,
  institutionDecisionImmutabilityFactionBoost,
  institutionalFactionBoost,
  membershipCharacterBoost,
  membershipItemBoost,
  mixedConstraintCharacterBoost,
  mixedConstraintFactionBoost,
  mixedConstraintItemBoost,
  motivationImmutabilityCharacterBoost,
  observerImmutabilityCharacterBoost,
  ruleWorldSettingBoost,
  sourceImmutabilityItemBoost,
  sourceObservationItemBoost,
} from "./retrieval-query-boosts.js";
import type {
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
} from "./types.js";
import type {
  RetrievalCandidateBundle,
  RetrievalCandidateProvider,
  RetrievePlanContextParams,
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
const RECENT_CHAPTER_SCAN_LIMIT =
  env.PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT * env.PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER;

export class RuleBasedCandidateProvider implements RetrievalCandidateProvider {
  async loadCandidates(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievalCandidateBundle> {
    // 规则召回负责先给出“业务上可信的候选集合”，
    // 后面的 rerank / embedding 都是在这个基线之上增强，而不是替代这里的业务约束。
    const outlines = await this.loadOutlines(db, params.bookId, params.chapterNo);
    const recentChapterResult = await this.loadRecentChapters(db, params.bookId, params.chapterNo);
    const characters = await this.loadCharacters(db, params);
    const factions = await this.loadFactions(db, params);
    const items = await this.loadItems(db, params);
    const hooks = await this.loadHooks(db, params);
    const relations = await this.loadRelations(db, params);
    const worldSettings = await this.loadWorldSettings(db, params);

    return {
      outlines,
      recentChapters: recentChapterResult.chapters,
      entityGroups: {
        hooks,
        characters,
        factions,
        items,
        relations,
        worldSettings,
      },
      stats: {
        recentChaptersScanned: recentChapterResult.scanned,
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
  ): Promise<{ chapters: RetrievedChapterSummary[]; scanned: number }> {
    // 近期章节摘要优先复用 chapters 主表已有 summary；
    // 如果主表还没同步完整，再依次回退到 final / draft；
    // 这里刻意不再回退到 plan.author_intent，避免把“打算发生什么”混成“已经发生什么”。
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

    const draftIds = rows.map((row) => row.current_draft_id).filter((value): value is number => value !== null);
    const finalIds = rows.map((row) => row.current_final_id).filter((value): value is number => value !== null);

    const [draftRows, finalRows] = await Promise.all([
      draftIds.length > 0
        ? db.selectFrom("chapter_drafts").select(["id", "summary"]).where("id", "in", draftIds).execute()
        : Promise.resolve([]),
      finalIds.length > 0
        ? db.selectFrom("chapter_finals").select(["id", "summary"]).where("id", "in", finalIds).execute()
        : Promise.resolve([]),
    ]);

    const draftSummaryMap = new Map(draftRows.map((row) => [row.id, row.summary]));
    const finalSummaryMap = new Map(finalRows.map((row) => [row.id, row.summary]));

    const chapters = rows
      .map((row) => ({
        id: row.id,
        chapterNo: row.chapter_no,
        title: row.title,
        summary:
          row.summary
          ?? (row.current_final_id ? finalSummaryMap.get(row.current_final_id) ?? null : null)
          ?? (row.current_draft_id ? draftSummaryMap.get(row.current_draft_id) ?? null : null),
        status: row.status,
      }))
      .filter((row) => Boolean(row.summary?.trim()))
      .slice(0, KEYWORD_LIMITS.recentChapters);

    return {
      chapters,
      scanned: rows.length,
    };
  }

  private async loadCharacters(
    db: import("kysely").Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievedEntity[]> {
    // 人物召回权重最重的是名字、别名、目标、当前位置，
    // 因为这些字段最容易直接影响本章动作与连续性，不适合只当成普通背景信息处理。
    const rows = await db.selectFrom("characters").selectAll().where("book_id", "=", params.bookId).where("status", "in", ["alive", "missing", "unknown"]).limit(ENTITY_SCAN_LIMIT).execute();

    return rankRows(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
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
        }) + membershipCharacterBoost({ currentLocation: row.current_location, professions: row.professions, appendNotes: row.append_notes }, params.keywords)
          + continuityCharacterBoost({ currentLocation: row.current_location, appendNotes: row.append_notes, status: row.status }, params.keywords)
          + crossEntityConflictCharacterBoost({ goal: row.goal, background: row.background, appendNotes: row.append_notes }, params.keywords)
          + mixedConstraintCharacterBoost({ currentLocation: row.current_location, appendNotes: row.append_notes, goal: row.goal }, params.keywords)
          + observerImmutabilityCharacterBoost({ background: row.background, goal: row.goal, appendNotes: row.append_notes }, params.keywords)
          + motivationImmutabilityCharacterBoost({ background: row.background, goal: row.goal, personality: row.personality, appendNotes: row.append_notes }, params.keywords),
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
          extraReasons: [
            membershipCharacterBoost({ currentLocation: row.current_location, professions: row.professions, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
            continuityCharacterBoost({ currentLocation: row.current_location, appendNotes: row.append_notes, status: row.status }, params.keywords) > 0 ? "continuity_risk" : null,
            crossEntityConflictCharacterBoost({ goal: row.goal, background: row.background, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
            mixedConstraintCharacterBoost({ currentLocation: row.current_location, appendNotes: row.append_notes, goal: row.goal }, params.keywords) > 0 ? "continuity_risk" : null,
            observerImmutabilityCharacterBoost({ background: row.background, goal: row.goal, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
            motivationImmutabilityCharacterBoost({ background: row.background, goal: row.goal, personality: row.personality, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          ].filter(Boolean) as string[],
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

  private async loadFactions(db: import("kysely").Kysely<DatabaseSchema>, params: RetrievePlanContextParams): Promise<RetrievedEntity[]> {
    const rows = await db.selectFrom("factions").selectAll().where("book_id", "=", params.bookId).limit(ENTITY_SCAN_LIMIT).execute();
    return rankRows(rows.map((row) => ({
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
        }) + institutionalFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + crossEntityConflictFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + mixedConstraintFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + institutionDecisionImmutabilityFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + authorityReactionFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords),
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
        extraReasons: [
          institutionalFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
          crossEntityConflictFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          mixedConstraintFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          institutionDecisionImmutabilityFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          authorityReactionFactionBoost({ category: row.category, coreGoal: row.core_goal, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
        ].filter(Boolean) as string[],
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
    })), KEYWORD_LIMITS.factions);
  }

  private async loadItems(db: import("kysely").Kysely<DatabaseSchema>, params: RetrievePlanContextParams): Promise<RetrievedEntity[]> {
    const rows = await db.selectFrom("items").selectAll().where("book_id", "=", params.bookId).limit(ENTITY_SCAN_LIMIT).execute();
    return rankRows(rows.map((row) => ({
      id: row.id,
      name: row.name,
      score: scoreEntity({ manualIds: params.manualRefs.itemIds, entityId: row.id, keywords: params.keywords, textSources: [row.name, row.description, row.append_notes, row.keywords] })
        + membershipItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + continuityItemBoost({ ownerType: row.owner_type, ownerId: row.owner_id, status: row.status, category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + mixedConstraintItemBoost({ ownerType: row.owner_type, ownerId: row.owner_id, status: row.status, category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords)
        + sourceObservationItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes, status: row.status }, params.keywords)
        + sourceImmutabilityItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes, status: row.status }, params.keywords),
      reason: buildReasons({
        manualIds: params.manualRefs.itemIds,
        entityId: row.id,
        keywords: params.keywords,
        textSources: [row.name, row.description, row.append_notes, row.keywords],
        extraReasons: [
          membershipItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
          continuityItemBoost({ ownerType: row.owner_type, ownerId: row.owner_id, status: row.status, category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          mixedConstraintItemBoost({ ownerType: row.owner_type, ownerId: row.owner_id, status: row.status, category: row.category, description: row.description, appendNotes: row.append_notes }, params.keywords) > 0 ? "continuity_risk" : null,
          sourceObservationItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes, status: row.status }, params.keywords) > 0 ? "continuity_risk" : null,
          sourceImmutabilityItemBoost({ category: row.category, description: row.description, appendNotes: row.append_notes, status: row.status }, params.keywords) > 0 ? "continuity_risk" : null,
        ].filter(Boolean) as string[],
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
    })), KEYWORD_LIMITS.items);
  }

  private async loadHooks(db: import("kysely").Kysely<DatabaseSchema>, params: RetrievePlanContextParams): Promise<RetrievedEntity[]> {
    const rows = await db.selectFrom("story_hooks").selectAll().where("book_id", "=", params.bookId).where("status", "in", ["open", "progressing"]).limit(ENTITY_SCAN_LIMIT).execute();
    return rankRows(rows.map((row) => ({
      id: row.id,
      title: row.title,
      score: scoreEntity({ manualIds: params.manualRefs.hookIds, entityId: row.id, keywords: params.keywords, textSources: [row.title, row.description, row.append_notes, row.keywords] }) + proximityBoost(row.target_chapter_no, params.chapterNo),
      reason: buildReasons({
        manualIds: params.manualRefs.hookIds,
        entityId: row.id,
        keywords: params.keywords,
        textSources: [row.title, row.description, row.append_notes, row.keywords],
        extraReasons: row.target_chapter_no && Math.abs(row.target_chapter_no - params.chapterNo) <= 2 ? ["chapter_proximity"] : [],
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
    })), KEYWORD_LIMITS.hooks);
  }

  private async loadRelations(db: import("kysely").Kysely<DatabaseSchema>, params: RetrievePlanContextParams): Promise<RetrievedEntity[]> {
    // 关系召回先把 source/target 名称补齐，再参与打分。
    // 否则 relation_type 和 description 往往太抽象，模型很难从“谁和谁之间的关系”这个维度真正命中意图。
    const rows = await db.selectFrom("relations").selectAll().where("book_id", "=", params.bookId).limit(ENTITY_SCAN_LIMIT).execute();
    const characterIds = rows.flatMap((row) => [row.source_type === "character" ? row.source_id : null, row.target_type === "character" ? row.target_id : null]).filter((value): value is number => value !== null);
    const factionIds = rows.flatMap((row) => [row.source_type === "faction" ? row.source_id : null, row.target_type === "faction" ? row.target_id : null]).filter((value): value is number => value !== null);
    const [characterRows, factionRows] = await Promise.all([
      characterIds.length > 0 ? db.selectFrom("characters").select(["id", "name"]).where("id", "in", [...new Set(characterIds)]).execute() : Promise.resolve([]),
      factionIds.length > 0 ? db.selectFrom("factions").select(["id", "name"]).where("id", "in", [...new Set(factionIds)]).execute() : Promise.resolve([]),
    ]);
    const characterNameMap = new Map(characterRows.map((row) => [row.id, row.name]));
    const factionNameMap = new Map(factionRows.map((row) => [row.id, row.name]));
    const manualEntityIds = new Set([...params.manualRefs.characterIds, ...params.manualRefs.factionIds]);
    return rankRows(rows.map((row) => {
      const relatedToManualEntity = manualEntityIds.has(row.source_id) || manualEntityIds.has(row.target_id);
      const sourceLabel = resolveRelationEndpointName(row.source_type, row.source_id, characterNameMap, factionNameMap);
      const targetLabel = resolveRelationEndpointName(row.target_type, row.target_id, characterNameMap, factionNameMap);
      return {
        id: row.id,
        score: scoreEntity({
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
        relationEndpoints: [
          row.source_type === "character" || row.source_type === "faction" ? { entityType: row.source_type, entityId: row.source_id, displayName: sourceLabel } : null,
          row.target_type === "character" || row.target_type === "faction" ? { entityType: row.target_type, entityId: row.target_id, displayName: targetLabel } : null,
        ].filter(Boolean),
        relationMetadata: {
          relationType: row.relation_type,
          status: row.status ?? undefined,
          description: row.description ?? undefined,
          appendNotes: row.append_notes ?? undefined,
        },
      };
    }), KEYWORD_LIMITS.relations);
  }

  private async loadWorldSettings(db: import("kysely").Kysely<DatabaseSchema>, params: RetrievePlanContextParams): Promise<RetrievedEntity[]> {
    // 世界设定更偏“规则边界”，因此 category/title 权重大于长文本 content。
    // 这样做是为了优先把制度、禁忌、组织规则这类容易一写就错的内容抬出来。
    const rows = await db.selectFrom("world_settings").selectAll().where("book_id", "=", params.bookId).where("status", "=", "active").limit(ENTITY_SCAN_LIMIT).execute();
    return rankRows(rows.map((row) => ({
      id: row.id,
      title: row.title,
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
      }) + ruleWorldSettingBoost({ title: row.title, category: row.category, content: row.content, appendNotes: row.append_notes }, params.keywords)
        + crossEntityConflictWorldSettingBoost({ title: row.title, category: row.category, content: row.content, appendNotes: row.append_notes }, params.keywords),
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
        extraReasons: [
          ruleWorldSettingBoost({ title: row.title, category: row.category, content: row.content, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
          crossEntityConflictWorldSettingBoost({ title: row.title, category: row.category, content: row.content, appendNotes: row.append_notes }, params.keywords) > 0 ? "institution_context" : null,
        ].filter(Boolean) as string[],
      }),
      content: compactLines([
        `title=${row.title}`,
        `category=${row.category}`,
        `content=${row.content}`,
        row.append_notes ? `append_notes=${row.append_notes}` : undefined,
      ]),
    })), KEYWORD_LIMITS.worldSettings);
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
