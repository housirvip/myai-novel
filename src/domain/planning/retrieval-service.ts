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
  PersistedSidecarSelectedBy,
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

type PersistedSelectionProvenance = Map<number, PersistedSidecarSelectedBy>;

type ScoredPersistedFactSelection = {
  row: {
    id: number;
    chapter_no: number | null;
    fact_type: string;
    fact_text: string;
    importance: number | null;
    risk_level: number | null;
  };
  trace: {
    score: number;
    keywordMatched: boolean;
    structuralManualMatch: boolean;
    keywordScore: number;
    riskScore: number;
    importanceScore: number;
    recencyScore: number;
    structuralBoost: number;
  };
};

type ScoredPersistedEventSelection = {
  row: {
    id: number;
    chapter_no: number | null;
    title: string;
    summary: string;
    unresolved_impact: string | null;
  };
  trace: {
    score: number;
    keywordMatched: boolean;
    structuralManualMatch: boolean;
    keywordScore: number;
    unresolvedScore: number;
    recencyScore: number;
    structuralBoost: number;
  };
};

type PersistedFactRow = {
  id: number;
  chapter_no: number | null;
  fact_type: string;
  fact_text: string;
  importance: number | null;
  risk_level: number | null;
  payload_json: string | null;
  entity_type: string | null;
  entity_id: number | null;
};

type PersistedStoryEventRow = {
  id: number;
  chapter_no: number | null;
  title: string;
  summary: string;
  unresolved_impact: string | null;
  participant_entity_refs: string | null;
  hook_refs: string | null;
};

async function loadPersistedRetrievalFacts(
  db: import("kysely").Kysely<import("../../core/db/schema/database.js").DatabaseSchema>,
  params: RetrievePlanContextParams,
): Promise<{ selected: PersistedRetrievalFact[]; considered: PersistedRetrievalFactSelectionObserved[] }> {
  const recentFetchLimit = Math.max(
    24,
    env.PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT * 2 + env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE,
  );
  const reserveFetchLimit = Math.max(
    8,
    env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE * 6,
  );
  const longTailMinChapterNo = params.chapterNo - env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP;

  const recentRowsQuery = db
    .selectFrom("retrieval_facts")
    .select(["id", "chapter_no", "fact_type", "fact_text", "importance", "risk_level", "payload_json", "entity_type", "entity_id"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("chapter_no", "is", null), eb("chapter_no", "<", params.chapterNo)]))
    .where((eb) => eb.or([eb("effective_from_chapter_no", "is", null), eb("effective_from_chapter_no", "<=", params.chapterNo)]))
    .where((eb) => eb.or([eb("effective_to_chapter_no", "is", null), eb("effective_to_chapter_no", ">=", params.chapterNo)]));

  const [recentRows, reserveRiskRows, reserveManualRows] = await Promise.all([
    recentRowsQuery
      .orderBy("chapter_no", "desc")
      .orderBy("id", "asc")
      .limit(recentFetchLimit)
      .execute(),
    env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE > 0
      ? recentRowsQuery
        .where("chapter_no", "<=", longTailMinChapterNo)
        .where("risk_level", ">=", env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK)
        .orderBy("chapter_no", "asc")
        .orderBy("risk_level", "desc")
        .orderBy("id", "asc")
        .limit(reserveFetchLimit)
        .execute()
      : Promise.resolve([] as PersistedFactRow[]),
    env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE > 0
      ? loadFarManualPersistedFactRows(db, params, longTailMinChapterNo, reserveFetchLimit)
      : Promise.resolve([] as PersistedFactRow[]),
  ]);

  const rows = mergeRowsById([...recentRows, ...reserveRiskRows, ...reserveManualRows]);

  const scored = rows
    .map((row) => ({
      row,
      trace: scorePersistedFact(params, row),
    }))
    .sort((left, right) => right.trace.score - left.trace.score || (right.row.chapter_no ?? 0) - (left.row.chapter_no ?? 0) || left.row.id - right.row.id);

  const selectedById = selectPersistedFactSelection(scored, params.chapterNo);
  const considered = scored.map(({ row, trace }, index) => {
    const chapterGap = getObservedChapterGap(row.chapter_no, params.chapterNo);
    const selectedBy = selectedById.get(row.id) ?? null;
    const longTailCandidate = isLongTailFactCandidate({ row, trace }, params.chapterNo);
    return {
      id: row.id,
      chapterNo: row.chapter_no,
      chapterGap,
      factType: row.fact_type,
      factText: row.fact_text,
      rank: index + 1,
      score: trace.score,
      selected: selectedBy !== null,
      selectedBy,
      longTailCandidate,
      droppedReason: (
        trace.score <= 0 ? "no_match" : selectedBy !== null ? null : "trimmed_by_top_k"
      ) as "no_match" | "trimmed_by_top_k" | null,
      surfacedIn: [],
      trace,
    };
  });

  const selected = orderSelectedPersistedFacts(scored, selectedById, params.chapterNo).map(({ row, trace }) => ({
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
  const recentFetchLimit = Math.max(
    16,
    env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT * 2 + env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE,
  );
  const reserveFetchLimit = Math.max(
    8,
    env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE * 8,
  );
  const longTailMinChapterNo = params.chapterNo - env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP;

  const recentRowsQuery = db
    .selectFrom("story_events")
    .select(["id", "chapter_no", "title", "summary", "unresolved_impact", "participant_entity_refs", "hook_refs"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("chapter_no", "is", null), eb("chapter_no", "<", params.chapterNo)]));

  const [recentRows, reserveUnresolvedRows, reserveManualRows] = await Promise.all([
    recentRowsQuery
      .orderBy("chapter_no", "desc")
      .orderBy("id", "asc")
      .limit(recentFetchLimit)
      .execute(),
    env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE > 0
      ? recentRowsQuery
        .where("chapter_no", "<=", longTailMinChapterNo)
        .where("unresolved_impact", "is not", null)
        .where("unresolved_impact", "!=", "")
        .orderBy("chapter_no", "asc")
        .orderBy("id", "asc")
        .limit(reserveFetchLimit)
        .execute()
      : Promise.resolve([] as PersistedStoryEventRow[]),
    env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE > 0
      ? loadFarManualPersistedStoryEventRows(db, params, longTailMinChapterNo, reserveFetchLimit)
      : Promise.resolve([] as PersistedStoryEventRow[]),
  ]);

  const rows = mergeRowsById([...recentRows, ...reserveUnresolvedRows, ...reserveManualRows]);

  const scored = rows
    .map((row) => ({
      row,
      trace: scorePersistedStoryEvent(params, row),
    }))
    .sort((left, right) => right.trace.score - left.trace.score || (right.row.chapter_no ?? 0) - (left.row.chapter_no ?? 0) || left.row.id - right.row.id);

  const selectedById = selectPersistedEventSelection(scored, params.chapterNo);
  const considered = scored.map(({ row, trace }, index) => {
    const chapterGap = getObservedChapterGap(row.chapter_no, params.chapterNo);
    const selectedBy = selectedById.get(row.id) ?? null;
    const longTailCandidate = isLongTailEventCandidate({ row, trace }, params.chapterNo);
    return {
      id: row.id,
      chapterNo: row.chapter_no,
      chapterGap,
      title: row.title,
      unresolvedImpact: row.unresolved_impact,
      rank: index + 1,
      score: trace.score,
      selected: selectedBy !== null,
      selectedBy,
      longTailCandidate,
      droppedReason: (
        trace.score <= 0 ? "no_match" : selectedBy !== null ? null : "trimmed_by_top_k"
      ) as "no_match" | "trimmed_by_top_k" | null,
      surfacedIn: [],
      trace,
    };
  });

  const selected = orderSelectedPersistedEvents(scored, selectedById, params.chapterNo).map(({ row, trace }) => ({
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
  const manualIds = collectManualSidecarIdsForEntityType(params, row.entity_type);
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

function selectPersistedFactSelection(
  scored: ScoredPersistedFactSelection[],
  currentChapterNo: number,
): PersistedSelectionProvenance {
  const positive = scored.filter((item) => item.trace.score > 0);
  const selected = positive.slice(0, env.PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT);
  const selectedById: PersistedSelectionProvenance = new Map<number, PersistedSidecarSelectedBy>(
    selected.map<[number, PersistedSidecarSelectedBy]>((item) => [item.row.id, "top_k"]),
  );

  if (env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE <= 0) {
    return selectedById;
  }

  const reserveCandidates = positive
    .filter((item) => !selectedById.has(item.row.id) && isLongTailFactCandidate(item, currentChapterNo))
    .sort((left, right) => compareFactLongTailPriority(left, right, currentChapterNo))
    .slice(0, env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE);

  for (const item of reserveCandidates) {
    selectedById.set(item.row.id, "long_tail_reserve");
  }

  return selectedById;
}

function selectPersistedEventSelection(
  scored: ScoredPersistedEventSelection[],
  currentChapterNo: number,
): PersistedSelectionProvenance {
  const positive = scored.filter((item) => item.trace.score > 0);
  const selected = positive.slice(0, env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT);
  const selectedById: PersistedSelectionProvenance = new Map<number, PersistedSidecarSelectedBy>(
    selected.map<[number, PersistedSidecarSelectedBy]>((item) => [item.row.id, "top_k"]),
  );

  if (env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE <= 0) {
    return selectedById;
  }

  const reserveCandidates = positive
    .filter((item) => !selectedById.has(item.row.id) && isLongTailEventCandidate(item, currentChapterNo))
    .sort((left, right) => compareEventLongTailPriority(left, right, currentChapterNo))
    .slice(0, env.PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE);

  for (const item of reserveCandidates) {
    selectedById.set(item.row.id, "long_tail_reserve");
  }

  return selectedById;
}

function orderSelectedPersistedFacts(
  scored: ScoredPersistedFactSelection[],
  selectedById: PersistedSelectionProvenance,
  currentChapterNo: number,
) {
  return scored
    .filter((item) => selectedById.has(item.row.id))
    .sort((left, right) => compareFactSelectionOrder(left, right, selectedById, currentChapterNo));
}

function orderSelectedPersistedEvents(
  scored: ScoredPersistedEventSelection[],
  selectedById: PersistedSelectionProvenance,
  currentChapterNo: number,
) {
  return scored
    .filter((item) => selectedById.has(item.row.id))
    .sort((left, right) => compareEventSelectionOrder(left, right, selectedById, currentChapterNo));
}

function isLongTailFactCandidate(
  item: ScoredPersistedFactSelection,
  currentChapterNo: number,
): boolean {
  const chapterGap = getEffectiveChapterGap(item.row.chapter_no, currentChapterNo);
  return chapterGap >= env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP
    && ((item.row.risk_level ?? 0) >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK || item.trace.structuralManualMatch);
}

function isLongTailEventCandidate(
  item: ScoredPersistedEventSelection,
  currentChapterNo: number,
): boolean {
  const chapterGap = getEffectiveChapterGap(item.row.chapter_no, currentChapterNo);
  return chapterGap >= env.PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP
    && (Boolean(item.row.unresolved_impact?.trim()) || item.trace.unresolvedScore > 0 || item.trace.structuralManualMatch);
}

function compareFactSelectionOrder(
  left: ScoredPersistedFactSelection,
  right: ScoredPersistedFactSelection,
  selectedById: PersistedSelectionProvenance,
  currentChapterNo: number,
): number {
  const reserveDelta = Number(selectedById.get(right.row.id) === "long_tail_reserve")
    - Number(selectedById.get(left.row.id) === "long_tail_reserve");
  if (reserveDelta !== 0) {
    return reserveDelta;
  }

  if (selectedById.get(left.row.id) === "long_tail_reserve" && selectedById.get(right.row.id) === "long_tail_reserve") {
    return compareFactLongTailPriority(left, right, currentChapterNo);
  }

  return comparePersistedSelectionScore(left, right);
}

function compareEventSelectionOrder(
  left: ScoredPersistedEventSelection,
  right: ScoredPersistedEventSelection,
  selectedById: PersistedSelectionProvenance,
  currentChapterNo: number,
): number {
  const reserveDelta = Number(selectedById.get(right.row.id) === "long_tail_reserve")
    - Number(selectedById.get(left.row.id) === "long_tail_reserve");
  if (reserveDelta !== 0) {
    return reserveDelta;
  }

  if (selectedById.get(left.row.id) === "long_tail_reserve" && selectedById.get(right.row.id) === "long_tail_reserve") {
    return compareEventLongTailPriority(left, right, currentChapterNo);
  }

  return comparePersistedSelectionScore(left, right);
}

function compareFactLongTailPriority(
  left: ScoredPersistedFactSelection,
  right: ScoredPersistedFactSelection,
  currentChapterNo: number,
): number {
  const manualDelta = Number(right.trace.structuralManualMatch) - Number(left.trace.structuralManualMatch);
  if (manualDelta !== 0) {
    return manualDelta;
  }

  const highRiskDelta = Number((right.row.risk_level ?? 0) >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK)
    - Number((left.row.risk_level ?? 0) >= env.PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK);
  if (highRiskDelta !== 0) {
    return highRiskDelta;
  }

  const chapterGapDelta = getEffectiveChapterGap(right.row.chapter_no, currentChapterNo)
    - getEffectiveChapterGap(left.row.chapter_no, currentChapterNo);
  if (chapterGapDelta !== 0) {
    return chapterGapDelta;
  }

  const riskDelta = (right.row.risk_level ?? 0) - (left.row.risk_level ?? 0);
  if (riskDelta !== 0) {
    return riskDelta;
  }

  return comparePersistedSelectionScore(left, right);
}

function compareEventLongTailPriority(
  left: ScoredPersistedEventSelection,
  right: ScoredPersistedEventSelection,
  currentChapterNo: number,
): number {
  const manualDelta = Number(right.trace.structuralManualMatch) - Number(left.trace.structuralManualMatch);
  if (manualDelta !== 0) {
    return manualDelta;
  }

  const unresolvedDelta = Number(Boolean(right.row.unresolved_impact?.trim()) || right.trace.unresolvedScore > 0)
    - Number(Boolean(left.row.unresolved_impact?.trim()) || left.trace.unresolvedScore > 0);
  if (unresolvedDelta !== 0) {
    return unresolvedDelta;
  }

  const chapterGapDelta = getEffectiveChapterGap(right.row.chapter_no, currentChapterNo)
    - getEffectiveChapterGap(left.row.chapter_no, currentChapterNo);
  if (chapterGapDelta !== 0) {
    return chapterGapDelta;
  }

  return comparePersistedSelectionScore(left, right);
}

function comparePersistedSelectionScore(
  left: { row: { chapter_no: number | null; id: number }; trace: { score: number } },
  right: { row: { chapter_no: number | null; id: number }; trace: { score: number } },
): number {
  return right.trace.score - left.trace.score
    || (right.row.chapter_no ?? 0) - (left.row.chapter_no ?? 0)
    || left.row.id - right.row.id;
}

function getObservedChapterGap(chapterNo: number | null, currentChapterNo: number): number | null {
  if (chapterNo === null) {
    return null;
  }
  return Math.max(0, currentChapterNo - chapterNo);
}

function getEffectiveChapterGap(chapterNo: number | null, currentChapterNo: number): number {
  return Math.max(0, currentChapterNo - (chapterNo ?? currentChapterNo));
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

function collectManualSidecarIdsForEntityType(
  params: RetrievePlanContextParams,
  entityType: string | null,
): number[] {
  switch (entityType) {
    case "character":
      return params.manualRefs.characterIds;
    case "faction":
      return params.manualRefs.factionIds;
    case "item":
      return params.manualRefs.itemIds;
    case "hook":
    case "story_hook":
      return params.manualRefs.hookIds;
    case "relation":
      return params.manualRefs.relationIds;
    case "world_setting":
      return params.manualRefs.worldSettingIds;
    default:
      return [];
  }
}

function countManualSidecarIds(params: RetrievePlanContextParams): number {
  return collectManualSidecarIds(params).length;
}

function mergeRowsById<Row extends { id: number }>(rows: Row[]): Row[] {
  const byId = new Map<number, Row>();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

async function loadFarManualPersistedFactRows(
  db: import("kysely").Kysely<import("../../core/db/schema/database.js").DatabaseSchema>,
  params: RetrievePlanContextParams,
  longTailMinChapterNo: number,
  limit: number,
): Promise<PersistedFactRow[]> {
  if (countManualSidecarIds(params) === 0) {
    return [];
  }

  return db
    .selectFrom("retrieval_facts")
    .select(["id", "chapter_no", "fact_type", "fact_text", "importance", "risk_level", "payload_json", "entity_type", "entity_id"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where("chapter_no", "<=", longTailMinChapterNo)
    .where((eb) => eb.or([eb("effective_from_chapter_no", "is", null), eb("effective_from_chapter_no", "<=", params.chapterNo)]))
    .where((eb) => eb.or([eb("effective_to_chapter_no", "is", null), eb("effective_to_chapter_no", ">=", params.chapterNo)]))
    .where((eb) => {
      const manualPredicates = buildPersistedFactManualPredicates(eb, params);
      return eb.or(manualPredicates);
    })
    .orderBy("chapter_no", "asc")
    .orderBy("id", "asc")
    .limit(limit)
    .execute();
}

function buildPersistedFactManualPredicates(
  eb: import("kysely").ExpressionBuilder<import("../../core/db/schema/database.js").DatabaseSchema, "retrieval_facts">,
  params: RetrievePlanContextParams,
) {
  const predicates = [];

  if (params.manualRefs.characterIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "=", "character"),
      eb("entity_id", "in", params.manualRefs.characterIds),
    ]));
  }
  if (params.manualRefs.factionIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "=", "faction"),
      eb("entity_id", "in", params.manualRefs.factionIds),
    ]));
  }
  if (params.manualRefs.itemIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "=", "item"),
      eb("entity_id", "in", params.manualRefs.itemIds),
    ]));
  }
  if (params.manualRefs.hookIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "in", ["hook", "story_hook"]),
      eb("entity_id", "in", params.manualRefs.hookIds),
    ]));
  }
  if (params.manualRefs.relationIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "=", "relation"),
      eb("entity_id", "in", params.manualRefs.relationIds),
    ]));
  }
  if (params.manualRefs.worldSettingIds.length > 0) {
    predicates.push(eb.and([
      eb("entity_type", "=", "world_setting"),
      eb("entity_id", "in", params.manualRefs.worldSettingIds),
    ]));
  }

  return predicates;
}

async function loadFarManualPersistedStoryEventRows(
  db: import("kysely").Kysely<import("../../core/db/schema/database.js").DatabaseSchema>,
  params: RetrievePlanContextParams,
  longTailMinChapterNo: number,
  limit: number,
): Promise<PersistedStoryEventRow[]> {
  const manualLikePatterns = buildStoryEventManualLikePatterns(params);
  if (manualLikePatterns.length === 0) {
    return [];
  }

  const baseQuery = db
    .selectFrom("story_events")
    .select(["id", "chapter_no", "title", "summary", "unresolved_impact", "participant_entity_refs", "hook_refs"])
    .where("book_id", "=", params.bookId)
    .where("status", "=", "active")
    .where("chapter_no", "<=", longTailMinChapterNo)
    .where((eb) => eb.or(buildStoryEventManualPrefetchPredicates(eb, manualLikePatterns)))
    .orderBy("chapter_no", "asc")
    .orderBy("id", "asc");

  const batchSize = Math.max(limit * 4, 16);
  const matchedRows = new Map<number, PersistedStoryEventRow>();

  for (let offset = 0; matchedRows.size < limit; offset += batchSize) {
    const rows = await baseQuery
      .limit(batchSize)
      .offset(offset)
      .execute();
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!matchesStoryEventRefs(params, row.participant_entity_refs, row.hook_refs)) {
        continue;
      }
      if (!matchedRows.has(row.id)) {
        matchedRows.set(row.id, row);
      }
      if (matchedRows.size >= limit) {
        break;
      }
    }

    if (rows.length < batchSize) {
      break;
    }
  }

  return Array.from(matchedRows.values());
}

function buildStoryEventManualLikePatterns(params: RetrievePlanContextParams): Array<{ field: "participant_entity_refs" | "hook_refs"; value: string }> {
  const patterns = new Map<string, { field: "participant_entity_refs" | "hook_refs"; value: string }>();

  const addPattern = (field: "participant_entity_refs" | "hook_refs", value: string) => {
    patterns.set(`${field}:${value}`, { field, value });
  };

  for (const characterId of params.manualRefs.characterIds) {
    addPattern("participant_entity_refs", `%\"entityType\":\"character\",\"entityId\":${characterId}%`);
    addPattern("participant_entity_refs", `%\"characters\":[%${characterId}%`);
  }
  for (const factionId of params.manualRefs.factionIds) {
    addPattern("participant_entity_refs", `%\"entityType\":\"faction\",\"entityId\":${factionId}%`);
    addPattern("participant_entity_refs", `%\"factions\":[%${factionId}%`);
  }
  for (const itemId of params.manualRefs.itemIds) {
    addPattern("participant_entity_refs", `%\"entityType\":\"item\",\"entityId\":${itemId}%`);
    addPattern("participant_entity_refs", `%\"items\":[%${itemId}%`);
  }
  for (const hookId of params.manualRefs.hookIds) {
    addPattern("participant_entity_refs", `%\"hooks\":[%${hookId}%`);
    addPattern("hook_refs", `%${hookId}%`);
  }
  for (const worldSettingId of params.manualRefs.worldSettingIds) {
    addPattern("participant_entity_refs", `%\"entityType\":\"world_setting\",\"entityId\":${worldSettingId}%`);
    addPattern("participant_entity_refs", `%\"worldSettings\":[%${worldSettingId}%`);
    addPattern("participant_entity_refs", `%\"world_settings\":[%${worldSettingId}%`);
  }

  return Array.from(patterns.values());
}

function buildStoryEventManualPrefetchPredicates(
  eb: import("kysely").ExpressionBuilder<import("../../core/db/schema/database.js").DatabaseSchema, "story_events">,
  patterns: Array<{ field: "participant_entity_refs" | "hook_refs"; value: string }>,
) {
  return patterns.map((pattern) => eb(pattern.field, "like", pattern.value));
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
