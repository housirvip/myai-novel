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

export type PromptContextMode =
  | "plan"
  | "draft"
  | "review"
  | "repair"
  | "approve"
  | "approveDiff";

interface PromptContextBlockConfig {
  mustFollowFactsLimit: number;
  recentChangesLimit: number;
  coreEntitiesLimit: number;
  requiredHooksLimit: number;
  forbiddenMovesLimit: number;
  supportingFactLimit: number;
  supportingOutlineLimit: number;
  coreFallbackLimit: number;
}

type RetrievedContextViewLike = {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  priorityContext?: RetrievedPriorityContext;
  recentChapters?: RetrievedChapterSummary[];
  riskReminders?: string[];
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

  const mustFollowFacts = summarizeFactPackets(priorityContext.blockingConstraints, config.mustFollowFactsLimit);
  const requiredHooks = summarizeFactPackets(
    priorityContext.blockingConstraints.filter((packet) => packet.entityType === "hook"),
    config.requiredHooksLimit,
  );
  const coreEntities = summarizeFactPackets(
    [...priorityContext.decisionContext, ...priorityContext.supportingContext].filter((packet) => packet.entityType !== "hook"),
    config.coreEntitiesLimit,
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
  })
    .slice(0, config.recentChangesLimit)
    .map((item) => `${item.label}：${item.detail}`);

  const forbiddenMoves = (value.riskReminders ?? []).slice(0, config.forbiddenMovesLimit);
  const supportingBackground = [
    ...summarizeFactPackets(priorityContext.supportingContext, config.supportingFactLimit),
    ...summarizeOutlines(value.supportingOutlines ?? value.outlines, config.supportingOutlineLimit),
  ].slice(0, config.supportingFactLimit + config.supportingOutlineLimit);

  return {
    // 如果 blocking facts 不足，就退回到 forbiddenMoves 顶上去，
    // 至少保证 prompt 还能看到一小组高风险提醒，而不是完全失去负面约束信息。
    mustFollowFacts: mustFollowFacts.length > 0 ? mustFollowFacts : forbiddenMoves.slice(0, 2),
    recentChanges,
    coreEntities: coreEntities.length > 0
      ? coreEntities
      : summarizeFactPackets(
        priorityContext.blockingConstraints.filter((packet) => packet.entityType !== "hook"),
          config.coreFallbackLimit,
        ),
    requiredHooks,
    forbiddenMoves,
    supportingBackground,
  };
}

function getPromptContextBlockConfig(mode: PromptContextMode): PromptContextBlockConfig {
  // 不同阶段看的上下文重点不一样：
  // plan/draft 更需要支撑信息，review/approveDiff 更需要收紧噪声，所以各 block limit 分别调小或调大。
  switch (mode) {
    case "plan":
      return {
        mustFollowFactsLimit: 5,
        recentChangesLimit: 3,
        coreEntitiesLimit: 4,
        requiredHooksLimit: 3,
        forbiddenMovesLimit: 4,
        supportingFactLimit: 2,
        supportingOutlineLimit: 2,
        coreFallbackLimit: 4,
      };
    case "review":
      return {
        mustFollowFactsLimit: 4,
        recentChangesLimit: 5,
        coreEntitiesLimit: 3,
        requiredHooksLimit: 1,
        forbiddenMovesLimit: 5,
        supportingFactLimit: 1,
        supportingOutlineLimit: 1,
        coreFallbackLimit: 3,
      };
    case "repair":
      return {
        mustFollowFactsLimit: 5,
        recentChangesLimit: 4,
        coreEntitiesLimit: 5,
        requiredHooksLimit: 2,
        forbiddenMovesLimit: 5,
        supportingFactLimit: 2,
        supportingOutlineLimit: 1,
        coreFallbackLimit: 4,
      };
    case "approve":
      return {
        mustFollowFactsLimit: 4,
        recentChangesLimit: 4,
        coreEntitiesLimit: 4,
        requiredHooksLimit: 2,
        forbiddenMovesLimit: 4,
        supportingFactLimit: 1,
        supportingOutlineLimit: 1,
        coreFallbackLimit: 3,
      };
    case "approveDiff":
      return {
        mustFollowFactsLimit: 3,
        recentChangesLimit: 5,
        coreEntitiesLimit: 2,
        requiredHooksLimit: 1,
        forbiddenMovesLimit: 5,
        supportingFactLimit: 1,
        supportingOutlineLimit: 0,
        coreFallbackLimit: 2,
      };
    case "draft":
    default:
      return {
        mustFollowFactsLimit: 5,
        recentChangesLimit: 4,
        coreEntitiesLimit: 6,
        requiredHooksLimit: 3,
        forbiddenMovesLimit: 4,
        supportingFactLimit: 2,
        supportingOutlineLimit: 2,
        coreFallbackLimit: 4,
      };
  }
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
  // 这里只抽每个 fact packet 的第一条状态和第一条风险，
  // 是为了把 prompt block 保持在“可快速扫读”的颗粒度，而不是把完整事实包原样塞回 prompt。
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
