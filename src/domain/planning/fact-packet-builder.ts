import type {
  PlanRetrievedContextEntityGroups,
  RetrievedEntity,
  RetrievedFactEntityType,
  RetrievedFactPacket,
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
  // fact packet 是给 prompt / rerank 消费的统一事实载体，
  // 这里先把不同实体压成同一套骨架，后续模块就不需要知道底层表结构差异。
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
    relatedDisplayNames: inferRelatedDisplayNames(entityType, entity),
    relationEndpoints: inferRelationEndpoints(entityType, entity),
    relationMetadata: inferRelationMetadata(entityType, entity),
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

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").replace(/\n+/g, "；").trim();
}

function inferContinuityRisk(content: string, reason: string): string[] {
  // 这里只做轻量启发式风险标注，不追求完整语义理解。
  // 它的作用是把“最容易写崩的连续性点”提前暴露给 prompt，而不是替代正式规则校验。
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

function inferRelatedDisplayNames(entityType: RetrievedFactEntityType, entity: RetrievedEntity): string[] {
  return inferRelationEndpoints(entityType, entity).map((endpoint) => endpoint.displayName);
}

function inferRelationEndpoints(entityType: RetrievedFactEntityType, entity: RetrievedEntity): Array<{
  entityType: "character" | "faction";
  entityId: number;
  displayName: string;
}> {
  if (entityType !== "relation") {
    return [];
  }

  if (entity.relationEndpoints && entity.relationEndpoints.length > 0) {
    return entity.relationEndpoints;
  }

  // 旧 retrieved_context 里关系端点可能还只埋在 content 文本里，
  // 所以这里会回退到字符串解析，避免历史 plan 数据在新 prompt 链路里丢失关系两端信息。
  return [parseRelationEndpoint(entity.content ?? "", "source"), parseRelationEndpoint(entity.content ?? "", "target")].filter(Boolean) as Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
}

function inferRelationMetadata(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievedFactPacket["relationMetadata"] {
  if (entityType !== "relation") {
    return undefined;
  }

  if (entity.relationMetadata) {
    return entity.relationMetadata;
  }

  // relationMetadata 也是新结构字段；
  // 对旧数据继续从 content 里捞，目的是让事实包尽量稳定，而不是要求用户先重跑全量 plan。
  const content = entity.content ?? "";
  const relationTypeMatch = content.match(/relation_type=([^；\n]+)/);
  const statusMatch = content.match(/status=([^；\n]+)/);
  const descriptionMatch = content.match(/description=([^；\n]+)/);
  const appendNotesMatch = content.match(/append_notes=([^；\n]+)/);

  if (!relationTypeMatch?.[1]) {
    return undefined;
  }

  return {
    relationType: relationTypeMatch[1].trim(),
    status: statusMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim(),
    appendNotes: appendNotesMatch?.[1]?.trim(),
  };
}

function parseRelationEndpoint(content: string, side: "source" | "target"): {
  entityType: "character" | "faction";
  entityId: number;
  displayName: string;
} | null {
  const match = content.match(new RegExp(`${side}=([^;(]+?) \\((character|faction):(\\d+)\\)`));
  if (!match) {
    return null;
  }

  const [, displayName, entityType, entityIdText] = match;
  const entityId = Number(entityIdText);
  if (!displayName || Number.isNaN(entityId)) {
    return null;
  }

  return {
    displayName: displayName.trim(),
    entityType: entityType as "character" | "faction",
    entityId,
  };
}
