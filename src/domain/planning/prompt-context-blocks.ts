import type {
  PlanRetrievedContextEntityGroups,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
  RetrievedPriorityContext,
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

type RetrievedContextViewLike = {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  priorityContext?: RetrievedPriorityContext;
  recentChapters?: RetrievedChapterSummary[];
  riskReminders?: string[];
  supportingOutlines?: RetrievedOutline[];
  characters?: RetrievedEntity[];
  factions?: RetrievedEntity[];
  items?: RetrievedEntity[];
  relations?: RetrievedEntity[];
  hooks?: RetrievedEntity[];
  worldSettings?: RetrievedEntity[];
};

export function buildPromptContextBlocks(context: unknown): PromptContextBlocks {
  const value = (context ?? {}) as RetrievedContextViewLike;
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

  const mustFollowFacts = summarizeFactPackets(priorityContext.blockingConstraints, 5);
  const requiredHooks = summarizeFactPackets(
    priorityContext.blockingConstraints.filter((packet) => packet.entityType === "hook"),
    3,
  );
  const coreEntities = summarizeFactPackets(
    [...priorityContext.decisionContext, ...priorityContext.supportingContext].filter((packet) => packet.entityType !== "hook"),
    6,
  );

  const recentChanges = buildRecentChanges({
    recentChapters: value.recentChapters,
    riskReminders: value.riskReminders,
    entities: [
      ...(hardConstraints.characters ?? []),
      ...(hardConstraints.items ?? []),
      ...(hardConstraints.relations ?? []),
      ...(hardConstraints.hooks ?? []),
      ...(hardConstraints.worldSettings ?? []),
    ],
  }).map((item) => `${item.label}：${item.detail}`);

  const forbiddenMoves = (value.riskReminders ?? []).slice(0, 4);
  const supportingBackground = [
    ...summarizeFactPackets(priorityContext.supportingContext, 3),
    ...summarizeOutlines(value.supportingOutlines, 2),
  ].slice(0, 4);

  return {
    mustFollowFacts: mustFollowFacts.length > 0 ? mustFollowFacts : forbiddenMoves.slice(0, 2),
    recentChanges,
    coreEntities: coreEntities.length > 0
      ? coreEntities
      : summarizeFactPackets(
          priorityContext.blockingConstraints.filter((packet) => packet.entityType !== "hook"),
          4,
        ),
    requiredHooks,
    forbiddenMoves,
    supportingBackground,
  };
}

function summarizeFactPackets(
  packets: Array<{
    entityType: string;
    displayName: string;
    currentState: string[];
    continuityRisk: string[];
  }>,
  limit: number,
): string[] {
  return packets.slice(0, limit).map((packet) => {
    const label = mapEntityTypeLabel(packet.entityType);
    const state = packet.currentState[0] ? normalizeInline(packet.currentState[0]) : "";
    const risk = packet.continuityRisk[0] ? `；风险=${packet.continuityRisk[0]}` : "";
    return state ? `${label}：${packet.displayName}；${state}${risk}` : `${label}：${packet.displayName}${risk}`;
  });
}

function summarizeOutlines(outlines?: RetrievedOutline[], limit = 3): string[] {
  return (outlines ?? [])
    .slice(0, limit)
    .map((outline) => {
      const summary = normalizeInline(outline.content);
      return summary ? `${outline.title}：${summary}` : outline.title;
    });
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
