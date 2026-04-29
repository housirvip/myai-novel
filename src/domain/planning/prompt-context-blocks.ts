import { env } from "../../config/env.js";
import type {
  PlanRetrievalObservability,
  PromptContextBlockSection,
  PromptContextObserved,
  PromptContextObservedSection,
  RetrievedFactPacket,
  PlanRetrievedContextEntityGroups,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
  RetrievedPriorityContext,
  RetrievedRecentChange,
  RetrievedRiskReminder,
} from "./types.js";
import { buildRecentChanges } from "./recent-changes.js";
import { buildPriorityContext } from "./retrieval-facts.js";

export interface PromptContextBlocks {
  mustFollowFacts: string[];
  recentChanges: string[];
  coreEntities: string[];
  requiredHooks: string[];
  forbiddenMoves: string[];
  supportingBackground: string[];
}

export type PromptContextMode =
  | "plan"
  | "draft"
  | "review"
  | "repair"
  | "approve"
  | "approveDiff";

export interface PromptContextBlocksObserved {
  blocks: PromptContextBlocks;
  observability: PromptContextObserved;
}

interface PromptContextLineEntry {
  text: string;
  sourceRefs: Array<{
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  }>;
}

interface PreparedPromptContextSection {
  key: PromptContextBlockSection;
  inputEntries: PromptContextLineEntry[];
  limitedEntries: PromptContextLineEntry[];
  maxChars: number;
  minCount: number;
  observability: PromptContextObservedSection;
}

interface AllocatedPromptContextSection {
  entries: PromptContextLineEntry[];
  observability: PromptContextObservedSection;
}

interface PromptContextBlockConfig {
  charBudget: number;
  sectionLineLimits: {
    mustFollowFacts: number;
    recentChanges: number;
    coreEntities: number;
    requiredHooks: number;
    forbiddenMoves: number;
    supportingBackground: number;
  };
  sectionCharBudgets: {
    mustFollowFacts: number;
    recentChanges: number;
    coreEntities: number;
    requiredHooks: number;
    forbiddenMoves: number;
    supportingBackground: number;
  };
}

type RetrievedContextViewLike = {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  priorityContext?: RetrievedPriorityContext;
  recentChapters?: RetrievedChapterSummary[];
  recentChanges?: RetrievedRecentChange[];
  riskReminders?: RetrievedRiskReminder[];
  outlines?: RetrievedOutline[];
  supportingOutlines?: RetrievedOutline[];
  characters?: RetrievedEntity[];
  factions?: RetrievedEntity[];
  items?: RetrievedEntity[];
  relations?: RetrievedEntity[];
  hooks?: RetrievedEntity[];
  worldSettings?: RetrievedEntity[];
  retrievalObservability?: PlanRetrievalObservability;
};

export function buildPromptContextBlocks(
  context: unknown,
  options: { mode?: PromptContextMode } = {},
): PromptContextBlocks {
  return buildPromptContextBlocksObserved(context, options).blocks;
}

export function buildPromptContextBlocksObserved(
  context: unknown,
  options: { mode?: PromptContextMode } = {},
): PromptContextBlocksObserved {
  // 这里负责把 retrieved context 压成 prompt 真正消费的几个固定区块。
  // 目标不是“尽量全”，而是在有限 token 预算里把最该先看的事实排进正确栏目。
  const value = (context ?? {}) as RetrievedContextViewLike;
  const config = getPromptContextBlockConfig(options.mode ?? "draft");
  const hardConstraints = {
    characters: value.hardConstraints?.characters ?? value.characters,
    factions: value.hardConstraints?.factions ?? value.factions,
    items: value.hardConstraints?.items ?? value.items,
    relations: value.hardConstraints?.relations ?? value.relations,
    hooks: value.hardConstraints?.hooks ?? value.hooks,
    worldSettings: value.hardConstraints?.worldSettings ?? value.worldSettings,
  } satisfies Partial<PlanRetrievedContextEntityGroups>;

  const priorityContext = value.priorityContext ?? buildPriorityContext({
    hardConstraints,
    softReferences: {
      characters: value.characters,
      factions: value.factions,
      items: value.items,
      relations: value.relations,
      hooks: value.hooks,
      worldSettings: value.worldSettings,
    },
  });

  const prioritizedBlockingPackets = prioritizePromptPackets(priorityContext.blockingConstraints);
  const blockingHookPackets = prioritizedBlockingPackets.filter((packet) => packet.entityType === "hook");
  const blockingNonHookPackets = prioritizedBlockingPackets.filter((packet) => packet.entityType !== "hook");
  const prioritizedCorePackets = prioritizePromptPackets(
    [...priorityContext.decisionContext, ...priorityContext.supportingContext].filter((packet) => packet.entityType !== "hook"),
  );
  const prioritizedSupportingPackets = prioritizePromptPackets(priorityContext.supportingContext);
  const mustFollowFacts = summarizeFactPacketEntries(blockingNonHookPackets);
  const requiredHooks = summarizeFactPacketEntries(blockingHookPackets);
  const mustFollowFactsHookFallback = requiredHooks.length > 0 ? requiredHooks.slice(0, 1) : [];
  const planRequiredHooks = mustFollowFacts.length > 0
    ? requiredHooks
    : requiredHooks.slice(mustFollowFactsHookFallback.length);
  const coreEntities = summarizeFactPacketEntries(prioritizedCorePackets);

  const recentChanges = (value.recentChanges && value.recentChanges.length > 0
    ? value.recentChanges
    : buildRecentChanges({
      recentChapters: value.recentChapters,
      riskReminders: value.riskReminders,
      entities: [
        ...(hardConstraints.characters ?? []),
        ...(hardConstraints.items ?? []),
        ...(hardConstraints.relations ?? []),
        ...(hardConstraints.hooks ?? []),
        ...(hardConstraints.worldSettings ?? []),
      ],
    }));

  const forbiddenMoves = summarizeRiskReminderEntries(value.riskReminders ?? []);
  const supportingBackground = [
    ...summarizeFactPacketEntries(prioritizedSupportingPackets),
    ...summarizeOutlineEntries(value.supportingOutlines ?? value.outlines),
  ];

  const prioritizedRecentChanges = options.mode === "plan"
    ? prioritizePlanRecentChanges(recentChanges)
    : recentChanges;

  const budgeted = allocateBudgetObserved({
    charBudget: config.charBudget,
    sections: options.mode === "plan"
      ? [
        preparePromptContextSection({
          key: "mustFollowFacts",
          entries: mustFollowFacts.length > 0
            ? mustFollowFacts
            : mustFollowFactsHookFallback.length > 0
              ? mustFollowFactsHookFallback
              : forbiddenMoves.slice(0, 2),
          lineLimit: config.sectionLineLimits.mustFollowFacts,
          maxChars: config.sectionCharBudgets.mustFollowFacts,
          minCount: 1,
        }),
        preparePromptContextSection({
          key: "recentChanges",
          entries: summarizeRecentChangeEntries(prioritizedRecentChanges),
          lineLimit: config.sectionLineLimits.recentChanges,
          maxChars: config.sectionCharBudgets.recentChanges,
          minCount: 0,
        }),
        preparePromptContextSection({
          key: "requiredHooks",
          entries: planRequiredHooks,
          lineLimit: config.sectionLineLimits.requiredHooks,
          maxChars: config.sectionCharBudgets.requiredHooks,
          minCount: 0,
        }),
        preparePromptContextSection({
          key: "forbiddenMoves",
          entries: forbiddenMoves,
          lineLimit: config.sectionLineLimits.forbiddenMoves,
          maxChars: config.sectionCharBudgets.forbiddenMoves,
          minCount: 0,
        }),
        preparePromptContextSection({
          key: "coreEntities",
          entries: coreEntities,
          lineLimit: config.sectionLineLimits.coreEntities,
          maxChars: config.sectionCharBudgets.coreEntities,
          minCount: 0,
        }),
        preparePromptContextSection({
          key: "supportingBackground",
          entries: supportingBackground,
          lineLimit: config.sectionLineLimits.supportingBackground,
          maxChars: config.sectionCharBudgets.supportingBackground,
          minCount: 0,
        }),
      ]
      : [
      preparePromptContextSection({
        key: "mustFollowFacts",
        entries: mustFollowFacts.length > 0 ? mustFollowFacts : forbiddenMoves.slice(0, 2),
        lineLimit: config.sectionLineLimits.mustFollowFacts,
        maxChars: config.sectionCharBudgets.mustFollowFacts,
        minCount: 1,
      }),
      preparePromptContextSection({
        key: "recentChanges",
        entries: summarizeRecentChangeEntries(prioritizedRecentChanges),
        lineLimit: config.sectionLineLimits.recentChanges,
        maxChars: config.sectionCharBudgets.recentChanges,
        minCount: 0,
      }),
      preparePromptContextSection({
        key: "coreEntities",
        entries: coreEntities,
        lineLimit: config.sectionLineLimits.coreEntities,
        maxChars: config.sectionCharBudgets.coreEntities,
        minCount: 0,
      }),
      preparePromptContextSection({
        key: "requiredHooks",
        entries: requiredHooks,
        lineLimit: config.sectionLineLimits.requiredHooks,
        maxChars: config.sectionCharBudgets.requiredHooks,
        minCount: 0,
      }),
      preparePromptContextSection({
        key: "forbiddenMoves",
        entries: forbiddenMoves,
        lineLimit: config.sectionLineLimits.forbiddenMoves,
        maxChars: config.sectionCharBudgets.forbiddenMoves,
        minCount: 0,
      }),
      preparePromptContextSection({
        key: "supportingBackground",
        entries: supportingBackground,
        lineLimit: config.sectionLineLimits.supportingBackground,
        maxChars: config.sectionCharBudgets.supportingBackground,
        minCount: 0,
      }),
    ],
  });

  const fallbackCoreEntities = summarizeFactPacketEntries(
    prioritizePromptPackets(priorityContext.blockingConstraints.filter((packet) => packet.entityType !== "hook")),
  );
  const remainingBudget = Math.max(0, config.charBudget - totalChars(flattenAllocatedSectionTexts(budgeted)));
  const fallbackCoreAllocation = preparePromptContextSection({
    key: "coreEntities",
    entries: fallbackCoreEntities,
    lineLimit: config.sectionLineLimits.coreEntities,
    maxChars: config.sectionCharBudgets.coreEntities,
    minCount: 0,
  });
  const fallbackCoreWithinBudget = budgeted.coreEntities.entries.length > 0
    ? budgeted.coreEntities
    : allocateSinglePromptContextSection(fallbackCoreAllocation, remainingBudget);

  const finalSections = {
    ...budgeted,
    coreEntities: fallbackCoreWithinBudget,
  } satisfies Record<PromptContextBlockSection, AllocatedPromptContextSection>;

  const blocks = {
    mustFollowFacts: finalSections.mustFollowFacts.entries.map((item) => item.text),
    recentChanges: finalSections.recentChanges.entries.map((item) => item.text),
    coreEntities: finalSections.coreEntities.entries.map((item) => item.text),
    requiredHooks: finalSections.requiredHooks.entries.map((item) => item.text),
    forbiddenMoves: finalSections.forbiddenMoves.entries.map((item) => item.text),
    supportingBackground: finalSections.supportingBackground.entries.map((item) => item.text),
  } satisfies PromptContextBlocks;

  return {
    blocks,
    observability: {
      charBudget: config.charBudget,
      sections: Object.fromEntries(
        (Object.keys(finalSections) as PromptContextBlockSection[]).map((key) => [key, finalSections[key].observability]),
      ) as Record<PromptContextBlockSection, PromptContextObservedSection>,
      surfacedPersistedRefs: collectSurfacedPersistedRefs(finalSections, value.retrievalObservability),
    },
  };
}

function getPromptContextBlockConfig(mode: PromptContextMode): PromptContextBlockConfig {
  switch (mode) {
    case "plan":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildPlanSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET),
      };
    case "review":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_REVIEW_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_REVIEW_CHAR_BUDGET),
      };
    case "repair":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_REPAIR_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_REPAIR_CHAR_BUDGET),
      };
    case "approve":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_APPROVE_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_APPROVE_CHAR_BUDGET),
      };
    case "approveDiff":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_APPROVE_DIFF_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_APPROVE_DIFF_CHAR_BUDGET),
      };
    case "draft":
    default:
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET),
      };
  }
}

function buildSectionLineLimits(): PromptContextBlockConfig["sectionLineLimits"] {
  return {
    mustFollowFacts: env.PLANNING_PROMPT_CONTEXT_MUST_FOLLOW_LIMIT,
    recentChanges: env.PLANNING_PROMPT_CONTEXT_RECENT_CHANGES_LIMIT,
    coreEntities: env.PLANNING_PROMPT_CONTEXT_CORE_ENTITIES_LIMIT,
    requiredHooks: env.PLANNING_PROMPT_CONTEXT_REQUIRED_HOOKS_LIMIT,
    forbiddenMoves: env.PLANNING_PROMPT_CONTEXT_FORBIDDEN_MOVES_LIMIT,
    supportingBackground: env.PLANNING_PROMPT_CONTEXT_SUPPORTING_BACKGROUND_LIMIT,
  };
}

function buildSectionCharBudgets(totalBudget: number): PromptContextBlockConfig["sectionCharBudgets"] {
  return {
    mustFollowFacts: Math.max(120, Math.floor(totalBudget * 0.26)),
    recentChanges: Math.max(100, Math.floor(totalBudget * 0.18)),
    coreEntities: Math.max(100, Math.floor(totalBudget * 0.18)),
    requiredHooks: Math.max(80, Math.floor(totalBudget * 0.14)),
    forbiddenMoves: Math.max(70, Math.floor(totalBudget * 0.10)),
    supportingBackground: Math.max(80, Math.floor(totalBudget * 0.14)),
  };
}

function buildPlanSectionCharBudgets(totalBudget: number): PromptContextBlockConfig["sectionCharBudgets"] {
  return {
    mustFollowFacts: Math.max(120, Math.floor(totalBudget * 0.30)),
    recentChanges: Math.max(100, Math.floor(totalBudget * 0.22)),
    coreEntities: Math.max(100, Math.floor(totalBudget * 0.10)),
    requiredHooks: Math.max(80, Math.floor(totalBudget * 0.18)),
    forbiddenMoves: Math.max(70, Math.floor(totalBudget * 0.08)),
    supportingBackground: Math.max(80, Math.floor(totalBudget * 0.12)),
  };
}

function prioritizePlanRecentChanges(changes: RetrievedRecentChange[]): RetrievedRecentChange[] {
  const persistedCarryover = changes.filter((item) => item.source === "retrieval_fact" || item.source === "story_event");
  const reservedPersisted = persistedCarryover.slice(0, 2);
  if (reservedPersisted.length === 0) {
    return changes;
  }

  const reservedKeys = new Set(reservedPersisted.map((item) => `${item.source}:${item.label}:${item.detail}`));
  const others = changes.filter((item) => !reservedKeys.has(`${item.source}:${item.label}:${item.detail}`));
  return [...reservedPersisted, ...others];
}

function summarizeFactPacketEntries(
  packets: Array<Pick<RetrievedFactPacket, "entityType" | "displayName" | "currentState" | "coreConflictOrGoal" | "continuityRisk" | "sourceRef" | "sourceRefs">>,
): PromptContextLineEntry[] {
  return packets.map((packet) => {
    const label = mapEntityTypeLabel(packet.entityType);
    const details = selectPacketDetails(packet);
    return {
      text: details.length > 0
        ? `${label}：${packet.displayName}；${details.join("；")}`
        : `${label}：${packet.displayName}`,
      sourceRefs: collectPersistedSourceRefs(packet),
    };
  });
}

function summarizeRecentChangeEntries(changes: RetrievedRecentChange[]): PromptContextLineEntry[] {
  return changes.map((item) => ({
    text: `${item.label}：${item.detail}`,
    sourceRefs: collectPersistedSourceRefs(item),
  }));
}

function summarizeRiskReminderEntries(reminders: RetrievedRiskReminder[]): PromptContextLineEntry[] {
  return reminders.map((item) => ({
    text: item.text,
    sourceRefs: collectPersistedSourceRefs(item),
  }));
}

function summarizeOutlineEntries(outlines?: RetrievedOutline[]): PromptContextLineEntry[] {
  return (outlines ?? []).map((outline) => {
    const summary = normalizeInline(outline.content);
    return {
      text: summary ? `${outline.title}：${summary}` : outline.title,
      sourceRefs: [],
    };
  });
}

function preparePromptContextSection(input: {
  key: PromptContextBlockSection;
  entries: PromptContextLineEntry[];
  lineLimit: number;
  maxChars: number;
  minCount: number;
}): PreparedPromptContextSection {
  const limitedEntries = input.entries.slice(0, input.lineLimit);
  return {
    key: input.key,
    inputEntries: input.entries,
    limitedEntries,
    maxChars: input.maxChars,
    minCount: input.minCount,
    observability: {
      inputCount: input.entries.length,
      outputCount: 0,
      lineLimitDropped: Math.max(0, input.entries.length - limitedEntries.length),
      budgetDropped: 0,
      clippedCount: 0,
    },
  };
}

function allocateBudgetObserved(input: {
  charBudget: number;
  sections: PreparedPromptContextSection[];
}): Record<PromptContextBlockSection, AllocatedPromptContextSection> {
  let remaining = input.charBudget;
  const result = {
    mustFollowFacts: createEmptyAllocatedSection(),
    recentChanges: createEmptyAllocatedSection(),
    coreEntities: createEmptyAllocatedSection(),
    requiredHooks: createEmptyAllocatedSection(),
    forbiddenMoves: createEmptyAllocatedSection(),
    supportingBackground: createEmptyAllocatedSection(),
  } satisfies Record<PromptContextBlockSection, AllocatedPromptContextSection>;

  for (const section of input.sections) {
    const allocated = allocateSinglePromptContextSection(section, Math.min(remaining, section.maxChars));
    result[section.key] = allocated;
    remaining -= allocated.entries.reduce((sum, item) => sum + item.text.length, 0);
  }

  return result;
}

function allocateSinglePromptContextSection(
  section: PreparedPromptContextSection,
  budget: number,
): AllocatedPromptContextSection {
  const allocation = takeLineEntriesWithinBudget(section.limitedEntries, budget, section.minCount);
  return {
    entries: allocation.entries,
    observability: {
      ...section.observability,
      outputCount: allocation.entries.length,
      budgetDropped: Math.max(0, section.limitedEntries.length - allocation.entries.length),
      clippedCount: allocation.clippedCount,
    },
  };
}

function takeLineEntriesWithinBudget(
  entries: PromptContextLineEntry[],
  budget: number,
  minCount: number,
): { entries: PromptContextLineEntry[]; clippedCount: number } {
  if (entries.length === 0) {
    return { entries: [], clippedCount: 0 };
  }

  const selected: PromptContextLineEntry[] = [];
  let clippedCount = 0;
  let used = 0;

  for (const entry of entries) {
    const remaining = Math.max(0, budget - used);
    if (remaining === 0 && selected.length >= minCount) {
      break;
    }

    const truncated = truncateLine(entry.text, remaining);
    if (!truncated) {
      break;
    }

    if (truncated.length < entry.text.length) {
      clippedCount += 1;
    }

    selected.push({
      text: truncated,
      sourceRefs: entry.sourceRefs,
    });
    used += truncated.length;

    if (selected.length >= minCount && used >= budget) {
      break;
    }
  }

  return {
    entries: selected,
    clippedCount,
  };
}

function truncateLine(line: string, budget: number): string {
  if (budget <= 0) {
    return "";
  }

  if (line.length <= budget) {
    return line;
  }

  if (budget === 1) {
    return "…";
  }

  return `${line.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
}

function selectPacketDetails(packet: {
  entityType: string;
  currentState: string[];
  coreConflictOrGoal?: string[];
  continuityRisk: string[];
}): string[] {
  const details: string[] = [];
  const stateCandidates = packet.currentState.map(normalizeInline).filter(Boolean);
  const goalCandidates = (packet.coreConflictOrGoal ?? []).map(normalizeInline).filter(Boolean);
  const riskCandidates = packet.continuityRisk.map(normalizeInline).filter(Boolean);

  for (const candidate of prioritizeStateDetails(packet.entityType, stateCandidates)) {
    if (!details.includes(candidate)) {
      details.push(candidate);
    }
    if (details.length >= 2) {
      break;
    }
  }

  if (details.length < 2) {
    for (const candidate of goalCandidates) {
      if (!details.includes(candidate)) {
        details.push(candidate);
      }
      if (details.length >= 2) {
        break;
      }
    }
  }

  if (riskCandidates[0] && !details.some((item) => item.includes("风险="))) {
    details.push(`风险=${riskCandidates[0]}`);
  }

  return details.slice(0, 3);
}

function prioritizeStateDetails(entityType: string, candidates: string[]): string[] {
  const priorities = getDetailPriority(entityType);
  return [...candidates].sort((left, right) => scoreDetailPriority(right, priorities) - scoreDetailPriority(left, priorities));
}

function getDetailPriority(entityType: string): string[] {
  switch (entityType) {
    case "character":
      return ["current_location=", "goal=", "status="];
    case "item":
      return ["owner_type=", "status=", "description="];
    case "relation":
      return ["relation_type=", "status=", "description="];
    case "world_setting":
      return ["规则", "制度", "category="];
    case "hook":
      return ["target_chapter_no=", "expected_payoff=", "description="];
    case "faction":
      return ["core_goal=", "status=", "description="];
    default:
      return [];
  }
}

function scoreDetailPriority(value: string, priorities: string[]): number {
  const index = priorities.findIndex((item) => value.includes(item));
  return index === -1 ? 0 : priorities.length - index;
}

function createEmptyAllocatedSection(): AllocatedPromptContextSection {
  return {
    entries: [],
    observability: {
      inputCount: 0,
      outputCount: 0,
      lineLimitDropped: 0,
      budgetDropped: 0,
      clippedCount: 0,
    },
  };
}

function flattenAllocatedSectionTexts(sections: Record<PromptContextBlockSection, AllocatedPromptContextSection>): string[] {
  return (Object.keys(sections) as PromptContextBlockSection[])
    .flatMap((key) => sections[key].entries.map((item) => item.text));
}

function collectPersistedSourceRefs(value: {
  sourceRef?: { sourceType: "persisted_fact" | "persisted_event"; sourceId: number };
  sourceRefs?: Array<{ sourceType: "persisted_fact" | "persisted_event"; sourceId: number }>;
}): Array<{ sourceType: "persisted_fact" | "persisted_event"; sourceId: number }> {
  const refs = [
    ...(value.sourceRef ? [value.sourceRef] : []),
    ...(value.sourceRefs ?? []),
  ];
  const seen = new Set<string>();
  const deduped: Array<{ sourceType: "persisted_fact" | "persisted_event"; sourceId: number }> = [];

  for (const ref of refs) {
    const key = `${ref.sourceType}:${ref.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(ref);
  }

  return deduped;
}

function collectSurfacedPersistedRefs(
  sections: Record<PromptContextBlockSection, AllocatedPromptContextSection>,
  retrievalObservability?: PlanRetrievalObservability,
) {
  const observedSelections = new Map<string, { chapterGap: number | null; selectedBy: PlanRetrievalObservability["persistedSidecarSelection"]["facts"][number]["selectedBy"] }>();

  for (const fact of retrievalObservability?.persistedSidecarSelection.facts ?? []) {
    observedSelections.set(`persisted_fact:${fact.id}`, {
      chapterGap: fact.chapterGap,
      selectedBy: fact.selectedBy,
    });
  }

  for (const event of retrievalObservability?.persistedSidecarSelection.events ?? []) {
    observedSelections.set(`persisted_event:${event.id}`, {
      chapterGap: event.chapterGap,
      selectedBy: event.selectedBy,
    });
  }

  const seen = new Set<string>();
  const surfaced = [];

  for (const key of Object.keys(sections) as PromptContextBlockSection[]) {
    for (const entry of sections[key].entries) {
      for (const ref of entry.sourceRefs) {
        const observedKey = `${key}:${ref.sourceType}:${ref.sourceId}`;
        if (seen.has(observedKey)) {
          continue;
        }
        seen.add(observedKey);
        const selection = observedSelections.get(`${ref.sourceType}:${ref.sourceId}`);
        surfaced.push({
          section: key,
          source: ref,
          chapterGap: selection?.chapterGap ?? null,
          selectedBy: selection?.selectedBy ?? null,
        });
      }
    }
  }

  return surfaced;
}

function prioritizePromptPackets(packets: RetrievedFactPacket[]): RetrievedFactPacket[] {
  return packets
    .map((packet, index) => ({ packet, index }))
    .sort((left, right) => comparePromptPacketPriority(left.packet, right.packet) || left.index - right.index)
    .map((entry) => entry.packet);
}

function comparePromptPacketPriority(left: RetrievedFactPacket, right: RetrievedFactPacket): number {
  const persistedDelta = Number(hasPersistedSourceRefs(right)) - Number(hasPersistedSourceRefs(left));
  if (persistedDelta !== 0) {
    return persistedDelta;
  }

  const continuityDelta = (right.scores.continuityRiskScore ?? 0) - (left.scores.continuityRiskScore ?? 0);
  if (continuityDelta !== 0) {
    return continuityDelta;
  }

  const finalScoreDelta = (right.scores.finalScore ?? 0) - (left.scores.finalScore ?? 0);
  if (finalScoreDelta !== 0) {
    return finalScoreDelta;
  }

  return (right.scores.recencyScore ?? 0) - (left.scores.recencyScore ?? 0);
}

function hasPersistedSourceRefs(packet: RetrievedFactPacket): boolean {
  return Boolean(packet.sourceRef) || Boolean(packet.sourceRefs && packet.sourceRefs.length > 0);
}

function totalChars(lines: string[]): number {
  return lines.reduce((sum, line) => sum + line.length, 0);
}

function mapEntityTypeLabel(entityType: string): string {
  switch (entityType) {
    case "character":
      return "人物";
    case "faction":
      return "势力";
    case "item":
      return "物品";
    case "relation":
      return "关系";
    case "hook":
      return "钩子";
    case "world_setting":
      return "世界规则";
    default:
      return "实体";
  }
}

function normalizeInline(value?: string | null): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "；")
    .trim();
}
