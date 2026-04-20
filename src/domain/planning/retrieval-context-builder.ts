import { buildRecentChanges } from "./recent-changes.js";
import { buildRetrievalObservability } from "./retrieval-observability.js";
import { buildPriorityContext } from "./retrieval-facts.js";
import { buildHardConstraints } from "./retrieval-hard-constraints.js";
import { buildRiskReminders } from "./retrieval-risk-reminders.js";
import { classifyPriorityPacket } from "./retrieval-priorities.js";
import { dedupePackets } from "./fact-packet-merge.js";
import type { PersistedRetrievalFact, PersistedRetrievalFactSelectionObserved, PersistedStoryEvent, PersistedStoryEventSelectionObserved, PlanRetrievedContext, PlanRetrievalObservability, RetrievedRiskReminder } from "./types.js";
import type { RetrievePlanContextParams, RetrievalCandidateBundle, RetrievalRerankerOutput } from "./retrieval-pipeline.js";

export function buildRetrievedContext(input: {
  params: RetrievePlanContextParams;
  book: {
    id: number;
    title: string;
    summary: string | null;
    target_chapter_count: number | null;
    current_chapter_count: number;
  };
  candidates: RetrievalCandidateBundle;
  reranked: RetrievalRerankerOutput;
  persistedFacts?: PersistedRetrievalFact[];
  persistedEvents?: PersistedStoryEvent[];
  persistedSelectionFunnel?: {
    facts: PersistedRetrievalFactSelectionObserved[];
    events: PersistedStoryEventSelectionObserved[];
  };
}): PlanRetrievedContext {
  // 这里是 retrieval 链路真正把“候选结果”收敛成“可持久化共享上下文”的地方。
  // 前面 provider / reranker 只负责找和排，这里才决定哪些结构会被后续 workflow 长期复用。
  const outlines = input.reranked.outlines;
  const recentChapters = input.reranked.recentChapters;
  const entityGroups = input.reranked.entityGroups;
  const { hooks, characters, factions, items, relations, worldSettings } = entityGroups;

  const hardConstraints = buildHardConstraints(entityGroups);
  // 这些派生视图不是彼此独立的功能点，而是围绕同一批候选事实做不同裁剪：
  // hardConstraints 给模型保底，riskReminders 暴露易错点，priorityContext 负责 prompt 分层，recentChanges 强调近期状态变化。
  const generatedRiskReminders = buildRiskReminders({
    hardConstraints,
    recentChapters,
  });
  const persistedRiskReminderEntries: RetrievedRiskReminder[] = [
    ...(input.persistedFacts ?? []).slice(0, 3).map((fact) => ({
      text: `注意承接既有事实：${fact.factText}`,
      sourceRef: {
        sourceType: "persisted_fact" as const,
        sourceId: fact.id,
      },
    })),
    ...(input.persistedEvents ?? [])
      .filter((event) => Boolean(event.unresolvedImpact?.trim()))
      .slice(0, 2)
      .map((event) => ({
        text: `注意未收束事件：${event.unresolvedImpact}`,
        sourceRef: {
          sourceType: "persisted_event" as const,
          sourceId: event.id,
        },
      })),
  ];
  const riskReminders = dedupeRiskReminderEntries([...generatedRiskReminders, ...persistedRiskReminderEntries]);
  const basePriorityContext = buildPriorityContext({
    hardConstraints,
    softReferences: entityGroups,
  });
  const persistedPriorityPackets = buildPersistedPriorityPackets({
    facts: input.persistedFacts,
    events: input.persistedEvents,
    currentChapterNo: input.params.chapterNo,
  });
  const priorityContext = mergePersistedPriorityPackets(basePriorityContext, persistedPriorityPackets);
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
    persistedFacts: input.persistedFacts,
    persistedEvents: input.persistedEvents,
  });
  const retrievalObservability = buildRetrievalObservability({
    params: input.params,
    candidates: input.candidates,
    reranked: input.reranked,
    hardConstraints,
    priorityContext,
    persistedFacts: input.persistedFacts,
    persistedEvents: input.persistedEvents,
    persistedSelectionFunnel: input.persistedSelectionFunnel,
  });
  applyPersistedSurfacingAttribution({
    observability: retrievalObservability,
    priorityContext,
    persistedRiskReminderEntries,
    recentChanges,
  });

  return {
    book: {
      id: input.book.id,
      title: input.book.title,
      summary: input.book.summary,
      targetChapterCount: input.book.target_chapter_count,
      currentChapterCount: input.book.current_chapter_count,
    },
    outlines,
    recentChapters,
    hooks,
    characters,
    factions,
    items,
    relations,
    worldSettings,
    hardConstraints,
    softReferences: {
      // softReferences 保留较完整的候选池，供不同阶段按需继续裁剪；
      // 它和 hardConstraints 的关系不是二选一，而是“共享基线 + 强约束子集”。
      outlines,
      recentChapters,
      entities: entityGroups,
    },
    priorityContext,
    retrievalObservability,
    recentChanges,
    riskReminders,
  };
}

function applyPersistedSurfacingAttribution(input: {
  observability: PlanRetrievalObservability;
  priorityContext: NonNullable<PlanRetrievedContext["priorityContext"]>;
  persistedRiskReminderEntries: RetrievedRiskReminder[];
  recentChanges: NonNullable<PlanRetrievedContext["recentChanges"]>;
}): void {
  const facts = input.observability.persistedSidecarSelection.facts as PersistedRetrievalFactSelectionObserved[];
  const events = input.observability.persistedSidecarSelection.events as PersistedStoryEventSelectionObserved[];

  for (const fact of facts) {
    if (input.priorityContext.blockingConstraints.some((packet) => packet.sourceRef?.sourceType === "persisted_fact" && packet.sourceRef.sourceId === fact.id)) {
      fact.surfacedIn.push("blockingConstraints");
    }
    if (input.priorityContext.decisionContext.some((packet) => packet.sourceRef?.sourceType === "persisted_fact" && packet.sourceRef.sourceId === fact.id)) {
      fact.surfacedIn.push("decisionContext");
    }
    if (input.persistedRiskReminderEntries.some((entry) => entry.sourceRef?.sourceType === "persisted_fact" && entry.sourceRef.sourceId === fact.id)) {
      fact.surfacedIn.push("riskReminders");
    }
    if (input.recentChanges.some((item) => item.sourceRef?.sourceType === "persisted_fact" && item.sourceRef.sourceId === fact.id)) {
      fact.surfacedIn.push("recentChanges");
    }
  }

  for (const event of events) {
    if (input.priorityContext.blockingConstraints.some((packet) => packet.sourceRef?.sourceType === "persisted_event" && packet.sourceRef.sourceId === event.id)) {
      event.surfacedIn.push("blockingConstraints");
    }
    if (input.priorityContext.decisionContext.some((packet) => packet.sourceRef?.sourceType === "persisted_event" && packet.sourceRef.sourceId === event.id)) {
      event.surfacedIn.push("decisionContext");
    }
    if (input.persistedRiskReminderEntries.some((entry) => entry.sourceRef?.sourceType === "persisted_event" && entry.sourceRef.sourceId === event.id)) {
      event.surfacedIn.push("riskReminders");
    }
    if (input.recentChanges.some((item) => item.sourceRef?.sourceType === "persisted_event" && item.sourceRef.sourceId === event.id)) {
      event.surfacedIn.push("recentChanges");
    }
  }
}


function buildPersistedPriorityPackets(input: {
  facts?: PersistedRetrievalFact[];
  events?: PersistedStoryEvent[];
  currentChapterNo: number;
}) {
  const factPackets = (input.facts ?? []).slice(0, 3).map((fact) => ({
    entityType: "chapter" as const,
    entityId: -fact.id,
    displayName: fact.chapterNo ? `第${fact.chapterNo}章事实` : `历史事实#${fact.id}`,
    identity: [fact.factType],
    currentState: [fact.factText],
    coreConflictOrGoal: [],
    recentChanges: [],
    continuityRisk: (fact.riskLevel ?? 0) >= 80 ? ["高风险已知事实需要承接"] : [],
    relevanceReasons: ["persisted_fact"],
    sourceRef: {
      sourceType: "persisted_fact" as const,
      sourceId: fact.id,
    },
    scores: {
      matchScore: fact.importance ?? 0,
      importanceScore: fact.importance ?? 0,
      continuityRiskScore: fact.riskLevel ?? 0,
      recencyScore: Math.max(0, 50 - Math.max(0, input.currentChapterNo - (fact.chapterNo ?? input.currentChapterNo))),
      manualPriorityScore: 0,
      finalScore: Math.max(fact.importance ?? 0, fact.riskLevel ?? 0, 55),
    },
  }));

  const eventPackets = (input.events ?? []).slice(0, 2).map((event) => ({
    entityType: "chapter" as const,
    entityId: -(100000 + event.id),
    displayName: event.chapterNo ? `第${event.chapterNo}章事件` : event.title,
    identity: [event.title],
    currentState: [event.summary],
    coreConflictOrGoal: event.unresolvedImpact ? [event.unresolvedImpact] : [],
    recentChanges: [],
    continuityRisk: event.unresolvedImpact ? ["未收束事件需要持续承接"] : [],
    relevanceReasons: ["persisted_event"],
    sourceRef: {
      sourceType: "persisted_event" as const,
      sourceId: event.id,
    },
    scores: {
      matchScore: event.unresolvedImpact ? 60 : 45,
      importanceScore: event.unresolvedImpact ? 60 : 40,
      continuityRiskScore: event.unresolvedImpact ? 70 : 0,
      recencyScore: Math.max(0, 50 - Math.max(0, input.currentChapterNo - (event.chapterNo ?? input.currentChapterNo))),
      manualPriorityScore: 0,
      finalScore: event.unresolvedImpact ? 72 : 52,
    },
  }));

  return [...factPackets, ...eventPackets];
}

function mergePersistedPriorityPackets(
  base: ReturnType<typeof buildPriorityContext>,
  packets: ReturnType<typeof buildPersistedPriorityPackets>,
) {
  const blockingConstraints = [...base.blockingConstraints];
  const decisionContext = [...base.decisionContext];
  const supportingContext = [...base.supportingContext];
  const backgroundNoise = [...base.backgroundNoise];

  for (const packet of packets) {
    const classification = classifyPriorityPacket(packet);
    if (classification.bucket === "blockingConstraints") {
      blockingConstraints.push(packet);
      continue;
    }
    if (classification.bucket === "decisionContext") {
      decisionContext.push(packet);
      continue;
    }
    if (classification.bucket === "supportingContext") {
      supportingContext.push(packet);
      continue;
    }
    backgroundNoise.push(packet);
  }

  return {
    blockingConstraints: dedupePackets(blockingConstraints),
    decisionContext: dedupePackets(decisionContext),
    supportingContext: dedupePackets(supportingContext),
    backgroundNoise: dedupePackets(backgroundNoise),
  };
}

function dedupeRiskReminderEntries(reminders: RetrievedRiskReminder[]): RetrievedRiskReminder[] {
  const seen = new Set<string>();
  const result: RetrievedRiskReminder[] = [];

  for (const reminder of reminders) {
    if (seen.has(reminder.text)) {
      continue;
    }
    seen.add(reminder.text);
    result.push(reminder);
  }

  return result;
}
