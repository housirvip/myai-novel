import { env } from "../../config/env.js";
import type {
  RetrievedFactPacket,
  PlanRetrievedContextEntityGroups,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
  RetrievedPriorityContext,
  RetrievedRecentChange,
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
  riskReminders?: Array<{ text: string }>;
  outlines?: RetrievedOutline[];
  supportingOutlines?: RetrievedOutline[];
  characters?: RetrievedEntity[];
  factions?: RetrievedEntity[];
  items?: RetrievedEntity[];
  relations?: RetrievedEntity[];
  hooks?: RetrievedEntity[];
  worldSettings?: RetrievedEntity[];
};

export function buildPromptContextBlocks(
  context: unknown,
  options: { mode?: PromptContextMode } = {},
): PromptContextBlocks {
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
  const prioritizedCorePackets = prioritizePromptPackets(
    [...priorityContext.decisionContext, ...priorityContext.supportingContext].filter((packet) => packet.entityType !== "hook"),
  );
  const prioritizedSupportingPackets = prioritizePromptPackets(priorityContext.supportingContext);
  const mustFollowFacts = summarizeFactPackets(prioritizedBlockingPackets);
  const requiredHooks = summarizeFactPackets(
    prioritizedBlockingPackets.filter((packet) => packet.entityType === "hook"),
  );
  const coreEntities = summarizeFactPackets(prioritizedCorePackets);

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
    }))
    .map((item) => `${item.label}：${item.detail}`);

  const forbiddenMoves = (value.riskReminders ?? []).map((item) => item.text);
  const supportingBackground = [
    ...summarizeFactPackets(prioritizedSupportingPackets),
    ...summarizeOutlines(value.supportingOutlines ?? value.outlines),
  ];

  const budgeted = allocateBudget({
    charBudget: config.charBudget,
    sections: [
      {
        key: "mustFollowFacts",
        lines: (mustFollowFacts.length > 0 ? mustFollowFacts : forbiddenMoves.slice(0, 2)).slice(0, config.sectionLineLimits.mustFollowFacts),
        maxChars: config.sectionCharBudgets.mustFollowFacts,
        minCount: 1,
      },
      { key: "recentChanges", lines: recentChanges.slice(0, config.sectionLineLimits.recentChanges), maxChars: config.sectionCharBudgets.recentChanges, minCount: 0 },
      { key: "coreEntities", lines: coreEntities.slice(0, config.sectionLineLimits.coreEntities), maxChars: config.sectionCharBudgets.coreEntities, minCount: 0 },
      { key: "requiredHooks", lines: requiredHooks.slice(0, config.sectionLineLimits.requiredHooks), maxChars: config.sectionCharBudgets.requiredHooks, minCount: 0 },
      { key: "forbiddenMoves", lines: forbiddenMoves.slice(0, config.sectionLineLimits.forbiddenMoves), maxChars: config.sectionCharBudgets.forbiddenMoves, minCount: 0 },
      { key: "supportingBackground", lines: supportingBackground.slice(0, config.sectionLineLimits.supportingBackground), maxChars: config.sectionCharBudgets.supportingBackground, minCount: 0 },
    ],
  });

  const fallbackCoreEntities = summarizeFactPackets(
    prioritizePromptPackets(priorityContext.blockingConstraints.filter((packet) => packet.entityType !== "hook")),
  );
  const remainingBudget = Math.max(0, config.charBudget - totalChars(Object.values(budgeted).flat()));
  const fallbackCoreWithinBudget = budgeted.coreEntities.length > 0
    ? budgeted.coreEntities
    : takeLinesWithinBudget(fallbackCoreEntities.slice(0, config.sectionLineLimits.coreEntities), remainingBudget, 0);

  return {
    mustFollowFacts: budgeted.mustFollowFacts,
    recentChanges: budgeted.recentChanges,
    coreEntities: fallbackCoreWithinBudget,
    requiredHooks: budgeted.requiredHooks,
    forbiddenMoves: budgeted.forbiddenMoves,
    supportingBackground: budgeted.supportingBackground,
  };
}

function getPromptContextBlockConfig(mode: PromptContextMode): PromptContextBlockConfig {
  switch (mode) {
    case "plan":
      return {
        charBudget: env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET,
        sectionLineLimits: buildSectionLineLimits(),
        sectionCharBudgets: buildSectionCharBudgets(env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET),
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

function summarizeFactPackets(
  packets: Array<Pick<RetrievedFactPacket, "entityType" | "displayName" | "currentState" | "coreConflictOrGoal" | "continuityRisk">>,
): string[] {
  return packets.map((packet) => {
    const label = mapEntityTypeLabel(packet.entityType);
    const details = selectPacketDetails(packet);
    return details.length > 0
      ? `${label}：${packet.displayName}；${details.join("；")}`
      : `${label}：${packet.displayName}`;
  });
}

function summarizeOutlines(outlines?: RetrievedOutline[]): string[] {
  return (outlines ?? [])
    .map((outline) => {
      const summary = normalizeInline(outline.content);
      return summary ? `${outline.title}：${summary}` : outline.title;
    });
}

function allocateBudget(input: {
  charBudget: number;
  sections: Array<{ key: keyof PromptContextBlocks; lines: string[]; maxChars: number; minCount: number }>;
}): PromptContextBlocks {
  let remaining = input.charBudget;
  const result = {
    mustFollowFacts: [],
    recentChanges: [],
    coreEntities: [],
    requiredHooks: [],
    forbiddenMoves: [],
    supportingBackground: [],
  } as PromptContextBlocks;

  for (const section of input.sections) {
    const selected = takeLinesWithinBudget(section.lines, Math.min(remaining, section.maxChars), section.minCount);
    assignSection(result, section.key, selected);
    remaining -= selected.reduce((sum, line) => sum + line.length, 0);
  }

  return result;
}

function takeLinesWithinBudget(lines: string[], budget: number, minCount: number): string[] {
  if (lines.length === 0) {
    return [];
  }

  const selected: string[] = [];
  let used = 0;

  for (const line of lines) {
    const remaining = Math.max(0, budget - used);
    if (remaining === 0 && selected.length >= minCount) {
      break;
    }

    const truncated = truncateLine(line, remaining);
    if (!truncated) {
      break;
    }

    selected.push(truncated);
    used += truncated.length;

    if (selected.length >= minCount && used >= budget) {
      break;
    }
  }

  return selected;
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

function assignSection(
  target: PromptContextBlocks,
  key: keyof PromptContextBlocks,
  value: string[],
): void {
  target[key] = value;
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
