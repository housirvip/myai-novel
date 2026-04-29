import type { RetrievePlanContextParams, RetrievalCandidateBundle, RetrievalRerankerOutput } from "./retrieval-pipeline.js";
import type {
  PersistedRetrievalFact,
  PersistedRetrievalFactSelectionObserved,
  PersistedStoryEvent,
  PersistedStoryEventSelectionObserved,
  PlanRetrievedContextEntityGroups,
  PlanRetrievalObservability,
  PromptContextObserved,
  PromptContextObservedSection,
  RetrievedEntity,
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
  RetrievalCandidateSource,
  RetrievalObservedEntity,
  RetrievalObservedHardConstraint,
  RetrievalObservedPriorityPacket,
} from "./types.js";
import { explainHardConstraintSelection } from "./retrieval-hard-constraints.js";
import { classifyPriorityPacket } from "./retrieval-priorities.js";

const FAR_CHAPTER_GAP = 8;

const ENTITY_GROUP_TO_TYPE = {
  hooks: "hook",
  characters: "character",
  factions: "faction",
  items: "item",
  relations: "relation",
  worldSettings: "world_setting",
} as const satisfies Record<keyof PlanRetrievedContextEntityGroups, RetrievedFactEntityType>;

export function buildRetrievalObservability(input: {
  params: RetrievePlanContextParams;
  candidates: RetrievalCandidateBundle;
  reranked: RetrievalRerankerOutput;
  hardConstraints: PlanRetrievedContextEntityGroups;
  priorityContext: RetrievedPriorityContext;
  persistedFacts?: PersistedRetrievalFact[];
  persistedEvents?: PersistedStoryEvent[];
  persistedSelectionFunnel?: {
    facts: PersistedRetrievalFactSelectionObserved[];
    events: PersistedStoryEventSelectionObserved[];
  };
}): PlanRetrievalObservability {
  const beforeRerank = summarizeObservedGroups(buildObservedEntityGroups(input.candidates.entityGroups));
  const afterRerank = summarizeObservedGroups(buildObservedEntityGroups(input.reranked.entityGroups));
  const priorityBucketCounts = {
    blockingConstraints: input.priorityContext.blockingConstraints.length,
    decisionContext: input.priorityContext.decisionContext.length,
    supportingContext: input.priorityContext.supportingContext.length,
    backgroundNoise: input.priorityContext.backgroundNoise.length,
  };

  return {
    query: {
      chapterNo: input.params.chapterNo,
      keywordCount: input.params.keywords.length,
      queryTextLength: input.params.queryText.length,
    },
    candidateVolumes: {
      beforeRerank,
      afterRerank,
      recentChaptersScanned: input.candidates.stats?.recentChaptersScanned ?? input.candidates.recentChapters.length,
      recentChaptersKept: input.reranked.recentChapters.length,
      outlinesKept: input.reranked.outlines.length,
    },
    retention: {
      hardConstraintPromotionCounts: summarizeHardConstraintRetention(input.reranked.entityGroups, input.hardConstraints),
      priorityBucketCounts,
    },
    persistedSidecarSelection: {
      facts: buildObservedPersistedFacts(input.params.chapterNo, input.persistedFacts, input.persistedSelectionFunnel?.facts),
      events: buildObservedPersistedEvents(input.params.chapterNo, input.persistedEvents, input.persistedSelectionFunnel?.events),
    },
    candidates: buildObservedEntityGroups(input.reranked.entityGroups),
    hardConstraints: buildObservedHardConstraintGroups(input.hardConstraints),
    priorityContext: buildObservedPriorityContext(input.priorityContext),
  };
}

export function summarizeRetrievalObservability(observability: PlanRetrievalObservability) {
  const factsSelected = observability.persistedSidecarSelection.facts.filter((item) => item.selected);
  const eventsSelected = observability.persistedSidecarSelection.events.filter((item) => item.selected);
  const promptContextPlan = observability.promptContext?.plan
    ? summarizePromptContextObserved(observability.promptContext.plan)
    : undefined;

  return {
    query: observability.query,
    candidateCountsBeforeRerank: observability.candidateVolumes.beforeRerank,
    candidateCountsAfterRerank: observability.candidateVolumes.afterRerank,
    recentChapterWindow: {
      scanned: observability.candidateVolumes.recentChaptersScanned,
      kept: observability.candidateVolumes.recentChaptersKept,
    },
    hardConstraintPromotionCounts: observability.retention.hardConstraintPromotionCounts,
    hardConstraintCounts: summarizeObservedGroups(observability.hardConstraints),
    priorityBucketCounts: observability.retention.priorityBucketCounts,
    persistedSidecarSelection: {
      factsConsidered: observability.persistedSidecarSelection.facts.length,
      factsSelected: factsSelected.length,
      factsDropped: observability.persistedSidecarSelection.facts.filter((item) => !item.selected).length,
      factsSelectedByTopK: factsSelected.filter((item) => item.selectedBy === "top_k").length,
      factsSelectedByLongTailReserve: factsSelected.filter((item) => item.selectedBy === "long_tail_reserve").length,
      factsLongTailCandidates: observability.persistedSidecarSelection.facts.filter((item) => item.longTailCandidate).length,
      eventsConsidered: observability.persistedSidecarSelection.events.length,
      eventsSelected: eventsSelected.length,
      eventsDropped: observability.persistedSidecarSelection.events.filter((item) => !item.selected).length,
      eventsSelectedByTopK: eventsSelected.filter((item) => item.selectedBy === "top_k").length,
      eventsSelectedByLongTailReserve: eventsSelected.filter((item) => item.selectedBy === "long_tail_reserve").length,
      eventsLongTailCandidates: observability.persistedSidecarSelection.events.filter((item) => item.longTailCandidate).length,
    },
    promptContextPlan,
  };
}

export function summarizePromptContextObserved(observability: PromptContextObserved | undefined) {
  if (!observability) {
    return undefined;
  }

  const surfacedPersistedRefCount = observability.surfacedPersistedRefs.length;
  const farChapterSurfacedPersistedRefCount = observability.surfacedPersistedRefs.filter((item) =>
    typeof item.chapterGap === "number" && item.chapterGap >= FAR_CHAPTER_GAP
  ).length;

  const sections = Object.fromEntries(
    (Object.entries(observability.sections) as Array<[string, PromptContextObservedSection]>).map(([section, value]) => [section, {
      inputCount: value.inputCount,
      outputCount: value.outputCount,
      lineLimitDropped: value.lineLimitDropped,
      budgetDropped: value.budgetDropped,
      clippedCount: value.clippedCount,
    }]),
  );

  const sectionLossTotals = (Object.values(observability.sections) as PromptContextObservedSection[]).reduce(
    (totals, section) => ({
      lineLimitDropped: totals.lineLimitDropped + section.lineLimitDropped,
      budgetDropped: totals.budgetDropped + section.budgetDropped,
      clippedCount: totals.clippedCount + section.clippedCount,
    }),
    { lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
  );

  return {
    charBudget: observability.charBudget,
    surfacedPersistedRefCount,
    farChapterSurfacedPersistedRefCount,
    farChapterSurfacedPersistedRefRatio: surfacedPersistedRefCount === 0
      ? 0
      : farChapterSurfacedPersistedRefCount / surfacedPersistedRefCount,
    sections,
    sectionLossTotals,
  };
}

function buildObservedEntityGroups(groups: PlanRetrievedContextEntityGroups): Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedEntity[]> {
  return {
    hooks: groups.hooks.map((entity) => observeEntity("hook", entity)),
    characters: groups.characters.map((entity) => observeEntity("character", entity)),
    factions: groups.factions.map((entity) => observeEntity("faction", entity)),
    items: groups.items.map((entity) => observeEntity("item", entity)),
    relations: groups.relations.map((entity) => observeEntity("relation", entity)),
    worldSettings: groups.worldSettings.map((entity) => observeEntity("world_setting", entity)),
  };
}

function buildObservedHardConstraintGroups(groups: PlanRetrievedContextEntityGroups): Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedHardConstraint[]> {
  return {
    hooks: groups.hooks.map((entity) => observeHardConstraint("hook", entity)),
    characters: groups.characters.map((entity) => observeHardConstraint("character", entity)),
    factions: groups.factions.map((entity) => observeHardConstraint("faction", entity)),
    items: groups.items.map((entity) => observeHardConstraint("item", entity)),
    relations: groups.relations.map((entity) => observeHardConstraint("relation", entity)),
    worldSettings: groups.worldSettings.map((entity) => observeHardConstraint("world_setting", entity)),
  };
}

function buildObservedPriorityContext(priorityContext: RetrievedPriorityContext) {
  return {
    blockingConstraints: priorityContext.blockingConstraints.map((packet) => observePriorityPacket(packet)),
    decisionContext: priorityContext.decisionContext.map((packet) => observePriorityPacket(packet)),
    supportingContext: priorityContext.supportingContext.map((packet) => observePriorityPacket(packet)),
    backgroundNoise: priorityContext.backgroundNoise.map((packet) => observePriorityPacket(packet)),
  };
}

function observeEntity(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievalObservedEntity {
  return {
    entityType,
    entityId: entity.id,
    displayName: entity.name ?? entity.title ?? `#${entity.id}`,
    source: inferCandidateSource(entity.reason),
    reasons: splitReasons(entity.reason),
    score: entity.score,
  };
}

function observeHardConstraint(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievalObservedHardConstraint {
  return {
    ...observeEntity(entityType, entity),
    selectedBy: explainHardConstraintSelection(entityType, entity),
  };
}

function observePriorityPacket(packet: RetrievedFactPacket): RetrievalObservedPriorityPacket {
  const classification = classifyPriorityPacket(packet);
  return {
    entityType: packet.entityType,
    entityId: packet.entityId,
    displayName: packet.displayName,
    source: inferPacketSource(packet),
    reasons: packet.relevanceReasons,
    score: packet.scores.finalScore,
    bucket: classification.bucket,
    assignedBy: classification.assignedBy,
  };
}

function inferCandidateSource(reason: string): RetrievalCandidateSource {
  if (reason.includes("embedding_match")) {
    return "embedding_only";
  }
  if (reason.includes("embedding_support")) {
    return "embedding_support";
  }
  return "rule";
}

function inferPacketSource(packet: RetrievedFactPacket): RetrievalCandidateSource {
  return inferCandidateSource(packet.relevanceReasons.join("+"));
}

function splitReasons(reason: string): string[] {
  return reason.split("+").filter(Boolean);
}

function summarizeObservedGroups(groups: Record<keyof PlanRetrievedContextEntityGroups, Array<RetrievalObservedEntity | RetrievalObservedHardConstraint>>) {
  return Object.fromEntries(
    (Object.keys(groups) as Array<keyof PlanRetrievedContextEntityGroups>).map((groupName) => {
      const observations = groups[groupName];
      return [
        groupName,
        {
          total: observations.length,
          rule: observations.filter((item) => item.source === "rule").length,
          embeddingSupport: observations.filter((item) => item.source === "embedding_support").length,
          embeddingOnly: observations.filter((item) => item.source === "embedding_only").length,
          entityType: ENTITY_GROUP_TO_TYPE[groupName],
        },
      ];
    }),
  ) as Record<keyof PlanRetrievedContextEntityGroups, {
    total: number;
    rule: number;
    embeddingSupport: number;
    embeddingOnly: number;
    entityType: RetrievedFactEntityType;
  }>;
}

function summarizeHardConstraintRetention(
  reranked: PlanRetrievedContextEntityGroups,
  hardConstraints: PlanRetrievedContextEntityGroups,
): Record<keyof PlanRetrievedContextEntityGroups, { promoted: number; leftAsSoft: number }> {
  return Object.fromEntries(
    (Object.keys(reranked) as Array<keyof PlanRetrievedContextEntityGroups>).map((groupName) => {
      const promoted = hardConstraints[groupName].length;
      const leftAsSoft = Math.max(0, reranked[groupName].length - promoted);
      return [groupName, { promoted, leftAsSoft }];
    }),
  ) as Record<keyof PlanRetrievedContextEntityGroups, { promoted: number; leftAsSoft: number }>;
}

function buildObservedPersistedFacts(
  currentChapterNo: number,
  facts?: PersistedRetrievalFact[],
  funnel?: PersistedRetrievalFactSelectionObserved[],
) {
  if (funnel && funnel.length > 0) {
    return funnel;
  }

  return (facts ?? []).map((fact) => ({
    id: fact.id,
    chapterNo: fact.chapterNo,
    chapterGap: fact.chapterNo === null ? null : Math.max(0, currentChapterNo - fact.chapterNo),
    factType: fact.factType,
    factText: fact.factText,
    rank: 1,
    score: fact.selectionTrace?.score ?? 0,
    selected: (fact.selectionTrace?.score ?? 0) > 0,
    selectedBy: null,
    longTailCandidate: false,
    droppedReason: null,
    surfacedIn: [],
    trace: {
      score: fact.selectionTrace?.score ?? 0,
      keywordMatched: fact.selectionTrace?.keywordMatched ?? false,
      structuralManualMatch: fact.selectionTrace?.structuralManualMatch ?? false,
      keywordScore: fact.selectionTrace?.keywordScore ?? 0,
      riskScore: fact.selectionTrace?.riskScore ?? 0,
      importanceScore: fact.selectionTrace?.importanceScore ?? 0,
      recencyScore: fact.selectionTrace?.recencyScore ?? 0,
      structuralBoost: fact.selectionTrace?.structuralBoost ?? 0,
    },
  }));
}

function buildObservedPersistedEvents(
  currentChapterNo: number,
  events?: PersistedStoryEvent[],
  funnel?: PersistedStoryEventSelectionObserved[],
) {
  if (funnel && funnel.length > 0) {
    return funnel;
  }

  return (events ?? []).map((event) => ({
    id: event.id,
    chapterNo: event.chapterNo,
    chapterGap: event.chapterNo === null ? null : Math.max(0, currentChapterNo - event.chapterNo),
    title: event.title,
    unresolvedImpact: event.unresolvedImpact,
    rank: 1,
    score: event.selectionTrace?.score ?? 0,
    selected: (event.selectionTrace?.score ?? 0) > 0,
    selectedBy: null,
    longTailCandidate: false,
    droppedReason: null,
    surfacedIn: [],
    trace: {
      score: event.selectionTrace?.score ?? 0,
      keywordMatched: event.selectionTrace?.keywordMatched ?? false,
      structuralManualMatch: event.selectionTrace?.structuralManualMatch ?? false,
      keywordScore: event.selectionTrace?.keywordScore ?? 0,
      unresolvedScore: event.selectionTrace?.unresolvedScore ?? 0,
      recencyScore: event.selectionTrace?.recencyScore ?? 0,
      structuralBoost: event.selectionTrace?.structuralBoost ?? 0,
    },
  }));
}
