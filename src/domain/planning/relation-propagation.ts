import type { RetrievedFactPacket, RetrievedPriorityContext } from "./types.js";
import { dedupePackets, dedupeStrings } from "./fact-packet-merge.js";

export function propagateRelationContext(input: {
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
  const candidateEndpoints = [...input.hardPackets, ...input.softPackets]
    .filter((packet) =>
      (packet.entityType === "character" || packet.entityType === "faction")
      && relatedEndpoints.has(`${packet.entityType}:${packet.entityId}`),
    )
    .map((packet) => enrichEndpointPacketWithRelationContext(packet, relationPackets));

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
      ...relationStateLines.filter((line) => line.includes("关系刚建立") || line.includes("状态=")),
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

function expandHardFactsFromRelations(input: {
  relationPackets: RetrievedFactPacket[];
  hardPackets: RetrievedFactPacket[];
  softPackets: RetrievedFactPacket[];
  candidateEndpoints: RetrievedFactPacket[];
}): RetrievedFactPacket[] {
  const hasMembershipRelation = input.relationPackets.some((packet) => packet.relationMetadata?.relationType === "member");
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

  return dedupePackets([
    ...characterPackets.filter((packet) => packet.currentState.some((line) => line.includes("current_location="))),
    ...relatedItems,
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

function hasRelatedOwnerId(line: string, relationCharacterIds: Set<number>): boolean {
  const match = line.match(/owner_id=(\d+)/);
  if (!match) {
    return false;
  }

  return relationCharacterIds.has(Number(match[1]));
}
