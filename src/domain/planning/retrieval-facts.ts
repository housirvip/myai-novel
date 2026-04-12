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
    relatedDisplayNames: inferRelatedDisplayNames(entityType, content),
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
  const propagatedFromRelations = propagateRelationContext({
    hardPackets,
    softPackets,
    prioritizedHard,
    prioritizedSoft,
  });

  return {
    blockingConstraints: dedupePackets([
      ...prioritizedHard.blockingConstraints,
      ...propagatedFromRelations.blockingConstraints,
    ]),
    decisionContext: dedupePackets([
      ...prioritizedHard.decisionContext,
      ...prioritizedSoft.blockingConstraints,
      ...prioritizedSoft.decisionContext,
      ...propagatedFromRelations.decisionContext,
    ]),
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

function inferRelatedDisplayNames(entityType: RetrievedFactEntityType, content: string): string[] {
  if (entityType !== "relation") {
    return [];
  }

  const names: string[] = [];
  const sourceMatch = content.match(/source=([^;(]+?) \(/);
  const targetMatch = content.match(/target=([^;(]+?) \(/);
  if (sourceMatch?.[1]) {
    names.push(sourceMatch[1].trim());
  }
  if (targetMatch?.[1]) {
    names.push(targetMatch[1].trim());
  }

  return names;
}

function propagateRelationContext(input: {
  hardPackets: RetrievedFactPacket[];
  softPackets: RetrievedFactPacket[];
  prioritizedHard: RetrievedPriorityContext;
  prioritizedSoft: RetrievedPriorityContext;
}): Pick<RetrievedPriorityContext, "blockingConstraints" | "decisionContext"> {
  const relationPackets = [
    ...input.prioritizedHard.blockingConstraints,
    ...input.prioritizedHard.decisionContext,
    ...input.prioritizedSoft.blockingConstraints,
    ...input.prioritizedSoft.decisionContext,
  ].filter((packet) => packet.entityType === "relation");

  if (relationPackets.length === 0) {
    return { blockingConstraints: [], decisionContext: [] };
  }

  const relatedNames = new Set(relationPackets.flatMap((packet) => packet.relatedDisplayNames ?? []));
  const candidateEndpoints = [...input.hardPackets, ...input.softPackets].filter((packet) =>
    (packet.entityType === "character" || packet.entityType === "faction") && relatedNames.has(packet.displayName),
  ).map((packet) => enrichEndpointPacketWithRelationContext(packet, relationPackets));
  const expandedHardFacts = expandHardFactsFromRelations({
    relationPackets,
    hardPackets: input.hardPackets,
    softPackets: input.softPackets,
    candidateEndpoints,
  });

  return {
    blockingConstraints: dedupePackets([
      ...candidateEndpoints.filter(
        (packet) => packet.continuityRisk.length > 0 || packet.currentState.some((item) => item.includes("current_location=")),
      ),
      ...expandedHardFacts,
    ]),
    decisionContext: candidateEndpoints,
  };
}

function enrichEndpointPacketWithRelationContext(
  packet: RetrievedFactPacket,
  relationPackets: RetrievedFactPacket[],
): RetrievedFactPacket {
  const relatedRelations = relationPackets.filter((relation) =>
    (relation.relatedDisplayNames ?? []).includes(packet.displayName),
  );
  if (relatedRelations.length === 0) {
    return packet;
  }

  const relationStateLines = relatedRelations
    .map((relation) => buildRelationEndpointSummary(packet.displayName, relation))
    .filter(Boolean) as string[];

  if (relationStateLines.length === 0) {
    return packet;
  }

  return {
    ...packet,
    currentState: dedupeStrings([...packet.currentState, ...relationStateLines]),
    recentChanges: dedupeStrings([
      ...packet.recentChanges,
      ...relationStateLines.filter((line) => line.includes("关系刚建立") || line.includes("status=")),
    ]),
    relevanceReasons: dedupeStrings([...packet.relevanceReasons, "relation_endpoint_link"]),
    scores: {
      ...packet.scores,
      importanceScore: packet.scores.importanceScore + 1,
      finalScore: packet.scores.finalScore + 5,
    },
  };
}

function buildRelationEndpointSummary(displayName: string, relation: RetrievedFactPacket): string | null {
  const content = relation.currentState.join("\n");
  const sourceMatch = content.match(/source=([^;(]+?) \(/);
  const targetMatch = content.match(/target=([^;(]+?) \(/);
  const relationTypeMatch = content.match(/relation_type=([^；\n]+)/);
  const statusMatch = content.match(/status=([^；\n]+)/);
  const descriptionMatch = content.match(/description=([^；\n]+)/);

  const sourceName = sourceMatch?.[1]?.trim();
  const targetName = targetMatch?.[1]?.trim();
  if (!sourceName || !targetName) {
    return null;
  }

  const counterpart = sourceName === displayName ? targetName : targetName === displayName ? sourceName : null;
  if (!counterpart) {
    return null;
  }

  const parts = [
    relationTypeMatch?.[1] ? `关系=${relationTypeMatch[1].trim()}` : null,
    statusMatch?.[1] ? `状态=${statusMatch[1].trim()}` : null,
    descriptionMatch?.[1] ? descriptionMatch[1].trim() : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return `relation_context=与${counterpart}相关`;
  }

  return `relation_context=与${counterpart}；${parts.join("；")}`;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function expandHardFactsFromRelations(input: {
  relationPackets: RetrievedFactPacket[];
  hardPackets: RetrievedFactPacket[];
  softPackets: RetrievedFactPacket[];
  candidateEndpoints: RetrievedFactPacket[];
}): RetrievedFactPacket[] {
  const hasMembershipRelation = input.relationPackets.some((packet) =>
    packet.currentState.some((line) => line.includes("relation_type=member")),
  );
  if (!hasMembershipRelation) {
    return [];
  }

  const hasInstitutionEndpoint = input.candidateEndpoints.some((packet) =>
    packet.entityType === "faction" && packet.currentState.some((line) => line.includes("category=宗门")),
  );

  const packets = [...input.hardPackets, ...input.softPackets];
  const characterPackets = input.candidateEndpoints.filter((packet) => packet.entityType === "character");

  const relatedItems = packets.filter((packet) =>
    packet.entityType === "item" && packet.currentState.some((line) => line.includes("owner_type=character") || line.includes("owner_id=")),
  );
  const relatedRules = hasInstitutionEndpoint
    ? packets.filter((packet) =>
        packet.entityType === "world_setting"
        && packet.currentState.some((line) => line.includes("规则") || line.includes("制度") || line.includes("category=规则")),
      )
    : [];

  return dedupePackets([
    ...characterPackets.filter((packet) => packet.currentState.some((line) => line.includes("current_location="))),
    ...relatedItems,
    ...relatedRules,
  ]).map((packet) => ({
    ...packet,
    relevanceReasons: dedupeStrings([...packet.relevanceReasons, "relation_hard_fact_link"]),
    scores: {
      ...packet.scores,
      importanceScore: packet.scores.importanceScore + 1,
      finalScore: packet.scores.finalScore + 8,
    },
  }));
}

function dedupePackets(packets: RetrievedFactPacket[]): RetrievedFactPacket[] {
  const merged = new Map<string, RetrievedFactPacket>();

  for (const packet of packets) {
    const key = `${packet.entityType}:${packet.entityId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, packet);
      continue;
    }

    merged.set(key, {
      ...existing,
      relatedDisplayNames: dedupeStrings([...(existing.relatedDisplayNames ?? []), ...(packet.relatedDisplayNames ?? [])]),
      identity: dedupeStrings([...existing.identity, ...packet.identity]),
      currentState: dedupeStrings([...existing.currentState, ...packet.currentState]),
      coreConflictOrGoal: dedupeStrings([...existing.coreConflictOrGoal, ...packet.coreConflictOrGoal]),
      recentChanges: dedupeStrings([...existing.recentChanges, ...packet.recentChanges]),
      continuityRisk: dedupeStrings([...existing.continuityRisk, ...packet.continuityRisk]),
      relevanceReasons: dedupeStrings([...existing.relevanceReasons, ...packet.relevanceReasons]),
      scores: {
        ...existing.scores,
        importanceScore: Math.max(existing.scores.importanceScore, packet.scores.importanceScore),
        continuityRiskScore: Math.max(existing.scores.continuityRiskScore, packet.scores.continuityRiskScore),
        recencyScore: Math.max(existing.scores.recencyScore, packet.scores.recencyScore),
        manualPriorityScore: Math.max(existing.scores.manualPriorityScore, packet.scores.manualPriorityScore),
        semanticScore: Math.max(existing.scores.semanticScore ?? 0, packet.scores.semanticScore ?? 0) || undefined,
        finalScore: Math.max(existing.scores.finalScore, packet.scores.finalScore),
        matchScore: Math.max(existing.scores.matchScore, packet.scores.matchScore),
      },
    });
  }

  return Array.from(merged.values());
}
