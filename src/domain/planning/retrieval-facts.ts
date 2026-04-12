import type {
  PlanRetrievedContextEntityGroups,
  RetrievedEntity,
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
} from "./types.js";
import { prioritizeFactPackets } from "./retrieval-priorities.js";

const ENTITY_TYPE_MAP = {
  characters: "character",
  factions: "faction",
  items: "item",
  relations: "relation",
  hooks: "hook",
  worldSettings: "world_setting",
} as const satisfies Record<keyof PlanRetrievedContextEntityGroups, RetrievedFactEntityType>;

export function buildFactPacket(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievedFactPacket {
  const displayName = entity.name ?? entity.title ?? `#${entity.id}`;
  const content = entity.content ?? "";
  const reason = entity.reason ?? "";
  const score = entity.score ?? 0;
  const normalizedContent = normalizeContent(content);
  const continuityRisk = inferContinuityRisk(content, reason);

  return {
    entityType,
    entityId: entity.id,
    displayName,
    identity: [`${displayName}`],
    currentState: normalizedContent ? [normalizedContent] : [],
    coreConflictOrGoal: [],
    recentChanges: [],
    continuityRisk,
    relevanceReasons: reason.split("+").filter(Boolean),
    scores: {
      matchScore: score,
      importanceScore: 0,
      continuityRiskScore: continuityRisk.length > 0 ? 1 : 0,
      recencyScore: 0,
      manualPriorityScore: reason.includes("manual_id") ? 1 : 0,
      finalScore: score,
    },
  };
}

export function buildFactPacketsFromGroups(groups: Partial<PlanRetrievedContextEntityGroups>): RetrievedFactPacket[] {
  const packets: RetrievedFactPacket[] = [];

  for (const [groupName, entityType] of Object.entries(ENTITY_TYPE_MAP) as Array<
    [keyof PlanRetrievedContextEntityGroups, RetrievedFactEntityType]
  >) {
    for (const entity of groups[groupName] ?? []) {
      packets.push(buildFactPacket(entityType, entity));
    }
  }

  return packets;
}

export function buildPriorityContext(input: {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  softReferences?: Partial<PlanRetrievedContextEntityGroups>;
}): RetrievedPriorityContext {
  const hardPackets = buildFactPacketsFromGroups(input.hardConstraints ?? {});
  const softPackets = buildFactPacketsFromGroups(input.softReferences ?? {}).filter(
    (packet) => !hardPackets.some((blocking) => samePacket(blocking, packet)),
  );

  const prioritizedHard = prioritizeFactPackets(hardPackets);
  const prioritizedSoft = prioritizeFactPackets(softPackets);

  return {
    blockingConstraints: prioritizedHard.blockingConstraints,
    decisionContext: [...prioritizedHard.decisionContext, ...prioritizedSoft.blockingConstraints, ...prioritizedSoft.decisionContext],
    supportingContext: [...prioritizedHard.supportingContext, ...prioritizedSoft.supportingContext],
    backgroundNoise: [...prioritizedHard.backgroundNoise, ...prioritizedSoft.backgroundNoise],
  };
}

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").replace(/\n+/g, "；").trim();
}

function inferContinuityRisk(content: string, reason: string): string[] {
  const text = `${content}\n${reason}`.toLowerCase();
  const risks: string[] = [];

  if (text.includes("current_location") || text.includes("location")) {
    risks.push("人物或实体位置需要连续承接");
  }
  if (text.includes("owner") || text.includes("owner_type")) {
    risks.push("物品持有状态需要连续承接");
  }
  if (text.includes("relation")) {
    risks.push("关系状态变化需要保持渐进合理");
  }
  if (text.includes("rule") || text.includes("制度") || text.includes("禁忌")) {
    risks.push("规则边界不能被正文随意覆盖");
  }

  return risks;
}

function samePacket(left: RetrievedFactPacket, right: RetrievedFactPacket): boolean {
  return left.entityType === right.entityType && left.entityId === right.entityId;
}
