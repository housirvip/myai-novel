import { env } from "../../config/env.js";
import type { AppLogger } from "../../core/logger/index.js";
import { executeDbAction } from "../shared/service-helpers.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type {
  ManualEntityRefs,
  PlanRetrievedContext,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
} from "./types.js";

interface RetrievePlanContextParams {
  bookId: number;
  chapterNo: number;
  keywords: string[];
  manualRefs: ManualEntityRefs;
}

interface RetrievalScoredRow {
  id: number;
  name?: string | null;
  title?: string | null;
  score: number;
  reason: string[];
  content: string;
}

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

export class RetrievalQueryService {
  constructor(private readonly logger: AppLogger) {}

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

        const outlines = await this.loadOutlines(db, params.bookId, params.chapterNo);
        const recentChapters = await this.loadRecentChapters(db, params.bookId, params.chapterNo);
        const characters = await this.loadCharacters(db, params);
        const factions = await this.loadFactions(db, params);
        const items = await this.loadItems(db, params);
        const hooks = await this.loadHooks(db, params);
        const relations = await this.loadRelations(db, params);
        const worldSettings = await this.loadWorldSettings(db, params);

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
          hooks,
          characters,
          factions,
          items,
          relations,
          worldSettings,
          riskReminders: buildRiskReminders({
            hooks,
            recentChapters,
            worldSettings,
          }),
        };
      },
    );
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
        score: scoreEntity({
          manualIds: params.manualRefs.characterIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [
            row.name,
            row.alias,
            row.background,
            row.current_location,
            row.personality,
            row.professions,
            row.levels,
            row.currencies,
            row.abilities,
            row.goal,
            row.append_notes,
            row.keywords,
          ],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.characterIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [
            row.name,
            row.alias,
            row.background,
            row.current_location,
            row.personality,
            row.professions,
            row.levels,
            row.currencies,
            row.abilities,
            row.goal,
            row.append_notes,
            row.keywords,
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
          textSources: [row.name, row.category, row.core_goal, row.append_notes, row.keywords],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.factionIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.name, row.core_goal, row.append_notes, row.keywords],
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
          score:
            scoreEntity({
              manualIds: params.manualRefs.relationIds,
              entityId: row.id,
              keywords: params.keywords,
              textSources: [
                sourceLabel,
                targetLabel,
                row.relation_type,
                row.description,
                row.append_notes,
                row.keywords,
              ],
            }) + (relatedToManualEntity ? 35 : 0),
          reason: buildReasons({
            manualIds: params.manualRefs.relationIds,
            entityId: row.id,
            keywords: params.keywords,
            textSources: [
              sourceLabel,
              targetLabel,
              row.relation_type,
              row.description,
              row.append_notes,
              row.keywords,
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
        score: scoreEntity({
          manualIds: params.manualRefs.worldSettingIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.title, row.category, row.content, row.append_notes, row.keywords],
        }),
        reason: buildReasons({
          manualIds: params.manualRefs.worldSettingIds,
          entityId: row.id,
          keywords: params.keywords,
          textSources: [row.title, row.category, row.content, row.append_notes, row.keywords],
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

function rankRows(rows: RetrievalScoredRow[], limit: number): RetrievedEntity[] {
  return rows
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name ?? undefined,
      title: row.title ?? undefined,
      reason: row.reason.join("+"),
      content: row.content,
      score: row.score,
    }));
}

function scoreEntity(input: {
  manualIds: number[];
  entityId: number;
  keywords: string[];
  textSources: Array<string | null>;
}): number {
  let score = input.manualIds.includes(input.entityId) ? 100 : 0;
  const haystack = input.textSources.filter(Boolean).join("\n").toLowerCase();

  for (const keyword of input.keywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      score += 25;
    }
  }

  return score;
}

function buildReasons(input: {
  manualIds: number[];
  entityId: number;
  keywords: string[];
  textSources: Array<string | null>;
  extraReasons?: string[];
}): string[] {
  const reasons = [...(input.extraReasons ?? [])];

  if (input.manualIds.includes(input.entityId)) {
    reasons.push("manual_id");
  }

  const haystack = input.textSources.filter(Boolean).join("\n").toLowerCase();
  if (input.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    reasons.push("keyword_hit");
  }

  return reasons.length > 0 ? reasons : ["low_relevance"];
}

function proximityBoost(targetChapterNo: number | null, chapterNo: number): number {
  if (!targetChapterNo) {
    return 0;
  }

  const distance = Math.abs(targetChapterNo - chapterNo);
  if (distance === 0) {
    return 40;
  }
  if (distance === 1) {
    return 25;
  }
  if (distance === 2) {
    return 10;
  }
  return 0;
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

function buildRiskReminders(input: {
  hooks: RetrievedEntity[];
  recentChapters: RetrievedChapterSummary[];
  worldSettings: RetrievedEntity[];
}): string[] {
  const reminders: string[] = [];

  if (input.hooks.some((hook) => hook.reason.includes("chapter_proximity"))) {
    reminders.push("存在接近回收章节的故事钩子，避免遗漏推进。");
  }

  if (input.recentChapters.length > 0) {
    reminders.push(`注意承接最近 ${input.recentChapters.length} 章的状态延续和人物位置变化。`);
  }

  if (input.worldSettings.length > 0) {
    reminders.push("注意不要违反已激活的世界规则、职业体系或货币体系。");
  }

  return reminders;
}
