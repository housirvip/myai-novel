import type {
  PlanRetrievedContextEntityGroups,
  RetrievedEntity,
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
} from "./types.js";

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
  const normalizedContent = normalizeContent(entity.content);
  const continuityRisk = inferContinuityRisk(entity.content, entity.reason);

  return {
    entityType,
    entityId: entity.id,
    displayName,
    identity: [`${displayName}`],
    currentState: normalizedContent ? [normalizedContent] : [],
    coreConflictOrGoal: [],
    recentChanges: [],
    continuityRisk,
    relevanceReasons: entity.reason.split("+").filter(Boolean),
    scores: {
      matchScore: entity.score,
      importanceScore: 0,
      continuityRiskScore: continuityRisk.length > 0 ? 1 : 0,
      recencyScore: 0,
      manualPriorityScore: entity.reason.includes("manual_id") ? 1 : 0,
      finalScore: entity.score,
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
  const blockingConstraints = buildFactPacketsFromGroups(input.hardConstraints ?? {});
  const decisionContext = buildFactPacketsFromGroups(input.softReferences ?? {}).filter(
    (packet) => !blockingConstraints.some((blocking) => samePacket(blocking, packet)),
  );

  return {
    blockingConstraints,
    decisionContext,
    supportingContext: [],
    backgroundNoise: [],
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
