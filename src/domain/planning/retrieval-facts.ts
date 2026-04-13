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

  return [parseRelationEndpoint(entity.content ?? "", "source"), parseRelationEndpoint(entity.content ?? "", "target")].filter(Boolean) as Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
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

  const relatedEndpoints = new Set(
    relationPackets.flatMap((packet) =>
      (packet.relationEndpoints ?? []).map((endpoint) => `${endpoint.entityType}:${endpoint.entityId}`),
    ),
  );
  const candidateEndpoints = [...input.hardPackets, ...input.softPackets].filter((packet) =>
    (packet.entityType === "character" || packet.entityType === "faction")
    && relatedEndpoints.has(`${packet.entityType}:${packet.entityId}`),
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
    (relation.relationEndpoints ?? []).some(
      (endpoint) => endpoint.entityType === packet.entityType && endpoint.entityId === packet.entityId,
    ),
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
  if (!relation.relationEndpoints || relation.relationEndpoints.length < 2) {
    return null;
  }

  const counterpart = relation.relationEndpoints.find((endpoint) => endpoint.displayName !== displayName)?.displayName ?? null;
  if (!counterpart) {
    return null;
  }

  const parts = [
    relation.relationMetadata?.relationType ? `关系=${relation.relationMetadata.relationType}` : null,
    relation.relationMetadata?.status ? `状态=${relation.relationMetadata.status}` : null,
    relation.relationMetadata?.description ? relation.relationMetadata.description : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return `relation_context=与${counterpart}相关`;
  }

  return `relation_context=与${counterpart}；${parts.join("；")}`;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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

function hasRelatedOwnerId(line: string, relationCharacterIds: Set<number>): boolean {
  const match = line.match(/owner_id=(\d+)/);
  if (!match) {
    return false;
  }

  return relationCharacterIds.has(Number(match[1]));
}

function expandHardFactsFromRelations(input: {
  relationPackets: RetrievedFactPacket[];
  hardPackets: RetrievedFactPacket[];
  softPackets: RetrievedFactPacket[];
  candidateEndpoints: RetrievedFactPacket[];
}): RetrievedFactPacket[] {
  const hasMembershipRelation = input.relationPackets.some((packet) =>
    packet.relationMetadata?.relationType === "member",
  );
  if (!hasMembershipRelation) {
    return [];
  }

  const packets = [...input.hardPackets, ...input.softPackets];
  const characterPackets = input.candidateEndpoints.filter((packet) => packet.entityType === "character");
  const relationCharacterIds = new Set(
    input.relationPackets.flatMap((packet) =>
      (packet.relationEndpoints ?? [])
        .filter((endpoint) => endpoint.entityType === "character")
        .map((endpoint) => endpoint.entityId),
    ),
  );

  const relatedItems = packets.filter((packet) =>
    packet.entityType === "item"
    && packet.currentState.some((line) => line.includes("owner_type=character"))
    && packet.currentState.some((line) => hasRelatedOwnerId(line, relationCharacterIds)),
  );
  const relatedRules: RetrievedFactPacket[] = [];

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

function inferRelationMetadata(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievedFactPacket["relationMetadata"] {
  if (entityType !== "relation") {
    return undefined;
  }

  if (entity.relationMetadata) {
    return entity.relationMetadata;
  }

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
