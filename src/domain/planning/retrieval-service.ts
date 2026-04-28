import { env } from "../../config/env.js";
import type { AppLogger } from "../../core/logger/index.js";
import { executeDbAction } from "../shared/service-helpers.js";
import { RuleBasedCandidateProvider } from "./retrieval-candidate-provider-rule.js";
import { buildRetrievedContext } from "./retrieval-context-builder.js";
import { createConfiguredReranker } from "./retrieval-reranker-factory.js";
import { EmbeddingCandidateProvider, type EmbeddingCandidateSearcher } from "./embedding-candidate-provider.js";
import { summarizeRetrievalObservability } from "./retrieval-observability.js";
import { buildReasons, scoreEntity } from "./retrieval-ranking.js";

import type {
  PersistedRetrievalFact,
  PersistedRetrievalFactSelectionObserved,
  PersistedStoryEvent,
  PersistedStoryEventSelectionObserved,
  PlanRetrievedContext,
} from "./types.js";
import {
  type RetrievalCandidateProvider,
  type RetrievalReranker,
  type RetrievePlanContextParams,
} from "./retrieval-pipeline.js";
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
    const shouldEnableEmbedding = env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER !== "none" && options?.embeddingSearcher;

    // embedding 候选不是替换规则召回，而是包在 baseProvider 外层做增强。
    // 这样即使实验链路关闭，主流程仍然保留稳定的规则式召回基线。
    this.candidateProvider = shouldEnableEmbedding
      ? new EmbeddingCandidateProvider(baseProvider, options.embeddingSearcher!, {
          limit: embeddingSearchMode === "hybrid"
            ? env.PLANNING_RETRIEVAL_EMBEDDING_LIMIT_HYBRID
            : env.PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC,
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
        const [persistedFactsResult, persistedEventsResult] = await Promise.all([
          loadPersistedRetrievalFacts(db, params),
          loadPersistedStoryEvents(db, params),
        ]);

        // 这里先产出完整上下文，再额外记录 observability 摘要；
        // 观测日志是为了调 retrieval 质量，不应反向影响实际写入 plan 的上下文内容。
        const context = buildRetrievedContext({
          params,
          book,
          candidates,
          reranked,
          persistedFacts: persistedFactsResult.selected,
          persistedEvents: persistedEventsResult.selected,
          persistedSelectionFunnel: {
            facts: persistedFactsResult.considered,
            events: persistedEventsResult.considered,
          },
        });
        if (context.retrievalObservability) {
          this.logger.info(
            {
              event: "planning.retrieve.observability",
              bookId: params.bookId,
              chapterNo: params.chapterNo,
              ...summarizeRetrievalObservability(context.retrievalObservability),
            },
            "Planning retrieval observability summary",
          );
        }

        return context;
      },
    );
  }

}

async function loadPersistedRetrievalFacts(
  db: import("kysely").Kysely<import("../../core/db/schema/database.js").DatabaseSchema>,
  params: RetrievePlanContextParams,
): Promise<{ selected: PersistedRetrievalFact[]; considered: PersistedRetrievalFactSelectionObserved[] }> {
  const rows = await db
    .selectFrom("retrieval_facts")
    .select(["id", "chapter_no", "fact_type", "fact_text", "importance", "risk_level", "payload_json", "entity_type", "entity_id"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("chapter_no", "is", null), eb("chapter_no", "<", params.chapterNo)]))
    .where((eb) => eb.or([eb("effective_from_chapter_no", "is", null), eb("effective_from_chapter_no", "<=", params.chapterNo)]))
    .where((eb) => eb.or([eb("effective_to_chapter_no", "is", null), eb("effective_to_chapter_no", ">=", params.chapterNo)]))
    .limit(24)
    .execute();

  const scored = rows
    .map((row) => ({
      row,
      trace: scorePersistedFact(params, row),
    }))
    .sort((left, right) => right.trace.score - left.trace.score || (right.row.chapter_no ?? 0) - (left.row.chapter_no ?? 0) || left.row.id - right.row.id);

  const selectedIds = selectPersistedFactIds(scored, params.chapterNo);
  const considered = scored.map(({ row, trace }, index) => ({
    id: row.id,
    chapterNo: row.chapter_no,
    factType: row.fact_type,
    factText: row.fact_text,
    rank: index + 1,
    score: trace.score,
    selected: selectedIds.has(row.id),
    droppedReason: (
      trace.score <= 0 ? "no_match" : selectedIds.has(row.id) ? null : "trimmed_by_top_k"
    ) as "no_match" | "trimmed_by_top_k" | null,
    surfacedIn: [],
    trace,
  }));

  const selected = scored.filter((item) => selectedIds.has(item.row.id)).map(({ row, trace }) => ({
    id: row.id,
    chapterNo: row.chapter_no,
    factType: row.fact_type,
    factText: row.fact_text,
    importance: row.importance,
    riskLevel: row.risk_level,
    selectionTrace: trace,
  }));

  return { selected, considered };
}

async function loadPersistedStoryEvents(
  db: import("kysely").Kysely<import("../../core/db/schema/database.js").DatabaseSchema>,
  params: RetrievePlanContextParams,
): Promise<{ selected: PersistedStoryEvent[]; considered: PersistedStoryEventSelectionObserved[] }> {
  const rows = await db
    .selectFrom("story_events")
    .select(["id", "chapter_no", "title", "summary", "unresolved_impact", "participant_entity_refs", "hook_refs"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("chapter_no", "is", null), eb("chapter_no", "<", params.chapterNo)]))
    .limit(16)
    .execute();

  const scored = rows
    .map((row) => ({
      row,
      trace: scorePersistedStoryEvent(params, row),
    }))
    .sort((left, right) => right.trace.score - left.trace.score || (right.row.chapter_no ?? 0) - (left.row.chapter_no ?? 0) || left.row.id - right.row.id);

  const selectedIds = selectPersistedEventIds(scored, params.chapterNo);
  const considered = scored.map(({ row, trace }, index) => ({
    id: row.id,
    chapterNo: row.chapter_no,
    title: row.title,
    unresolvedImpact: row.unresolved_impact,
    rank: index + 1,
    score: trace.score,
    selected: selectedIds.has(row.id),
    droppedReason: (
      trace.score <= 0 ? "no_match" : selectedIds.has(row.id) ? null : "trimmed_by_top_k"
    ) as "no_match" | "trimmed_by_top_k" | null,
    surfacedIn: [],
    trace,
  }));

  const selected = scored.filter((item) => selectedIds.has(item.row.id)).map(({ row, trace }) => ({
    id: row.id,
    chapterNo: row.chapter_no,
    title: row.title,
    summary: row.summary,
    unresolvedImpact: row.unresolved_impact,
    selectionTrace: trace,
  }));

  return { selected, considered };
}

function scorePersistedFact(
  params: RetrievePlanContextParams,
  row: {
    id: number;
    chapter_no: number | null;
    fact_type: string;
    fact_text: string;
    importance: number | null;
    risk_level: number | null;
    payload_json: string | null;
    entity_type: string | null;
    entity_id: number | null;
  },
): {
  score: number;
  keywordMatched: boolean;
  structuralManualMatch: boolean;
  keywordScore: number;
  riskScore: number;
  importanceScore: number;
  recencyScore: number;
  structuralBoost: number;
} {
  const payloadText = row.payload_json ?? "";
  const queryKeywords = buildSidecarKeywords(params);
  const textSources = [row.fact_type, row.fact_text, payloadText, row.entity_type];
  const weightedTextSources = [
    { text: row.fact_text, weight: 18 },
    { text: row.fact_type, weight: 10 },
    { text: payloadText, weight: 8 },
    { text: row.entity_type, weight: 6 },
  ];
  const manualIds = collectManualSidecarIds(params);
  const structuralManualMatch = matchesManualEntityRef(params, row.entity_type, row.entity_id);

  const keywordScore = scoreEntity({
    manualIds,
    entityId: row.entity_id ?? -row.id,
    keywords: queryKeywords,
    textSources,
    weightedTextSources,
  });
  const reasonText = buildReasons({
    manualIds,
    entityId: row.entity_id ?? -row.id,
    keywords: queryKeywords,
    textSources,
  }).join("+");
  const recencyScore = Math.max(0, 24 - Math.max(0, params.chapterNo - (row.chapter_no ?? params.chapterNo)));
  const riskScore = Math.floor((row.risk_level ?? 0) / 4);
  const importanceScore = Math.floor((row.importance ?? 0) / 5);
  const matched = reasonText.includes("keyword_hit") || reasonText.includes("manual_id");

  const structuralBoost = structuralManualMatch ? 40 : 0;
  const score = matched || structuralManualMatch
    ? keywordScore + riskScore + importanceScore + recencyScore + structuralBoost
    : 0;

  return {
    score,
    keywordMatched: matched,
    structuralManualMatch,
    keywordScore,
    riskScore,
    importanceScore,
    recencyScore,
    structuralBoost,
  };
}

function scorePersistedStoryEvent(
  params: RetrievePlanContextParams,
  row: {
    id: number;
    chapter_no: number | null;
    title: string;
    summary: string;
    unresolved_impact: string | null;
    participant_entity_refs: string | null;
    hook_refs: string | null;
  },
): {
  score: number;
  keywordMatched: boolean;
  structuralManualMatch: boolean;
  keywordScore: number;
  unresolvedScore: number;
  recencyScore: number;
  structuralBoost: number;
} {
  const participantRefs = row.participant_entity_refs ?? "";
  const hookRefs = row.hook_refs ?? "";
  const queryKeywords = buildSidecarKeywords(params);
  const manualIds = collectManualSidecarIds(params);
  const structuralManualMatch = matchesStoryEventRefs(params, row.participant_entity_refs, row.hook_refs);
  const keywordScore = scoreEntity({
    manualIds,
    entityId: -row.id,
    keywords: queryKeywords,
    weightedTextSources: [
      { text: row.title, weight: 14 },
      { text: row.summary, weight: 16 },
      { text: row.unresolved_impact, weight: 18 },
      { text: participantRefs, weight: 10 },
      { text: hookRefs, weight: 10 },
    ],
  });
  const reasonText = buildReasons({
    manualIds,
    entityId: -row.id,
    keywords: queryKeywords,
    textSources: [row.title, row.summary, row.unresolved_impact, participantRefs, hookRefs],
  }).join("+");
  const unresolvedScore = row.unresolved_impact ? 18 : 0;
  const recencyScore = Math.max(0, 22 - Math.max(0, params.chapterNo - (row.chapter_no ?? params.chapterNo)));
  const matched = reasonText.includes("keyword_hit") || reasonText.includes("manual_id");

  const structuralBoost = structuralManualMatch ? 45 : 0;
  const score = matched || structuralManualMatch
    ? keywordScore + unresolvedScore + recencyScore + structuralBoost
    : 0;

  return {
    score,
    keywordMatched: matched,
    structuralManualMatch,
    keywordScore,
    unresolvedScore,
    recencyScore,
    structuralBoost,
  };
}

function selectPersistedFactIds(
  scored: Array<{
    row: { id: number; chapter_no: number | null; risk_level: number | null };
    trace: { score: number; structuralManualMatch: boolean };
  }>,
  currentChapterNo: number,
): Set<number> {
  const positive = scored.filter((item) => item.trace.score > 0);
  const selected = positive.slice(0, env.PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT);
  const selectedIds = new Set(selected.map((item) => item.row.id));

  for (const item of positive) {
    if (selectedIds.size >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT) {
      break;
    }
    if (!isLongTailFactCandidate(item, currentChapterNo) || selectedIds.has(item.row.id)) {
      continue;
    }
    selectedIds.add(item.row.id);
  }

  if (env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE <= 0) {
    return selectedIds;
  }

  let reserved = 0;
  for (const item of positive) {
    if (reserved >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE) {
      break;
    }
    if (!isLongTailFactCandidate(item, currentChapterNo) || selectedIds.has(item.row.id)) {
      continue;
    }
    selectedIds.add(item.row.id);
    reserved += 1;
  }

  return selectedIds;
}

function selectPersistedEventIds(
  scored: Array<{
    row: { id: number; chapter_no: number | null; unresolved_impact: string | null };
    trace: { score: number; structuralManualMatch: boolean; unresolvedScore: number };
  }>,
  currentChapterNo: number,
): Set<number> {
  const positive = scored.filter((item) => item.trace.score > 0);
  const selected = positive.slice(0, env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT);
  const selectedIds = new Set(selected.map((item) => item.row.id));

  if (env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE <= 0) {
    return selectedIds;
  }

  let reserved = 0;
  for (const item of positive) {
    if (reserved >= env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE) {
      break;
    }
    if (!isLongTailEventCandidate(item, currentChapterNo) || selectedIds.has(item.row.id)) {
      continue;
    }
    selectedIds.add(item.row.id);
    reserved += 1;
  }

  return selectedIds;
}

function isLongTailFactCandidate(
  item: {
    row: { chapter_no: number | null; risk_level: number | null };
    trace: { score: number; structuralManualMatch: boolean };
  },
  currentChapterNo: number,
): boolean {
  const chapterGap = Math.max(0, currentChapterNo - (item.row.chapter_no ?? currentChapterNo));
  return chapterGap >= env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP
    && ((item.row.risk_level ?? 0) >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK || item.trace.structuralManualMatch);
}

function isLongTailEventCandidate(
  item: {
    row: { chapter_no: number | null; unresolved_impact: string | null };
    trace: { score: number; structuralManualMatch: boolean; unresolvedScore: number };
  },
  currentChapterNo: number,
): boolean {
  const chapterGap = Math.max(0, currentChapterNo - (item.row.chapter_no ?? currentChapterNo));
  return chapterGap >= env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP
    && (Boolean(item.row.unresolved_impact?.trim()) || item.trace.unresolvedScore > 0 || item.trace.structuralManualMatch);
}

function buildSidecarKeywords(params: RetrievePlanContextParams): string[] {
  const queryTerms = params.queryText
    .split(/[\s,，。；;、]+/)
    .map((term) => term.trim())
    .filter(Boolean);
  return Array.from(new Set([...params.keywords, ...queryTerms]));
}

function collectManualSidecarIds(params: RetrievePlanContextParams): number[] {
  return [
    ...params.manualRefs.characterIds,
    ...params.manualRefs.factionIds,
    ...params.manualRefs.itemIds,
    ...params.manualRefs.hookIds,
    ...params.manualRefs.relationIds,
    ...params.manualRefs.worldSettingIds,
  ];
}

function matchesManualEntityRef(
  params: RetrievePlanContextParams,
  entityType: string | null,
  entityId: number | null,
): boolean {
  if (!entityType || entityId === null) {
    return false;
  }

  switch (entityType) {
    case "character":
      return params.manualRefs.characterIds.includes(entityId);
    case "faction":
      return params.manualRefs.factionIds.includes(entityId);
    case "item":
      return params.manualRefs.itemIds.includes(entityId);
    case "hook":
    case "story_hook":
      return params.manualRefs.hookIds.includes(entityId);
    case "relation":
      return params.manualRefs.relationIds.includes(entityId);
    case "world_setting":
      return params.manualRefs.worldSettingIds.includes(entityId);
    default:
      return false;
  }
}

function matchesStoryEventRefs(
  params: RetrievePlanContextParams,
  participantEntityRefs: string | null,
  hookRefs: string | null,
): boolean {
  const participants = parseParticipantEntityRefs(participantEntityRefs);
  if (participants.some((participant) => matchesManualEntityRef(params, participant.entityType, participant.entityId))) {
    return true;
  }

  const hooks = parseHookRefs(hookRefs);
  return hooks.some((hookId) => params.manualRefs.hookIds.includes(hookId));
}

function parseParticipantEntityRefs(value: string | null): Array<{ entityType: string; entityId: number }> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is { entityType: string; entityId: number } =>
        typeof item === "object"
          && item !== null
          && typeof (item as { entityType?: unknown }).entityType === "string"
          && typeof (item as { entityId?: unknown }).entityId === "number"
      );
    }
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    const grouped = parsed as {
      characters?: unknown;
      factions?: unknown;
      items?: unknown;
      hooks?: unknown;
      worldSettings?: unknown;
      world_settings?: unknown;
    };
    return [
      ...expandParticipantIds("character", grouped.characters),
      ...expandParticipantIds("faction", grouped.factions),
      ...expandParticipantIds("item", grouped.items),
      ...expandParticipantIds("hook", grouped.hooks),
      ...expandParticipantIds("world_setting", grouped.worldSettings ?? grouped.world_settings),
    ];
  } catch {
    return [];
  }
}

function expandParticipantIds(entityType: string, value: unknown): Array<{ entityType: string; entityId: number }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)
    .map((entityId) => ({ entityType, entityId }));
}

function parseHookRefs(value: string | null): number[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is number => typeof item === "number");
  } catch {
    return [];
  }
}
