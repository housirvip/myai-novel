import { normalizeFactPacketProvenance } from "./provenance.js";
import type { RetrievedFactPacket } from "./types.js";

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function samePacket(left: RetrievedFactPacket, right: RetrievedFactPacket): boolean {
  return left.entityType === right.entityType && left.entityId === right.entityId;
}

export function dedupePackets(packets: RetrievedFactPacket[]): RetrievedFactPacket[] {
  const merged = new Map<string, RetrievedFactPacket>();

  for (const packet of packets) {
    const key = `${packet.entityType}:${packet.entityId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, packet);
      continue;
    }

    merged.set(key, normalizeFactPacketProvenance({
      ...existing,
      relatedDisplayNames: dedupeStrings([...(existing.relatedDisplayNames ?? []), ...(packet.relatedDisplayNames ?? [])]),
      relationEndpoints: dedupeRelationEndpoints([...(existing.relationEndpoints ?? []), ...(packet.relationEndpoints ?? [])]),
      relationMetadata: packet.relationMetadata ?? existing.relationMetadata,
      identity: dedupeStrings([...existing.identity, ...packet.identity]),
      currentState: dedupeStrings([...existing.currentState, ...packet.currentState]),
      coreConflictOrGoal: dedupeStrings([...existing.coreConflictOrGoal, ...packet.coreConflictOrGoal]),
      recentChanges: dedupeStrings([...existing.recentChanges, ...packet.recentChanges]),
      continuityRisk: dedupeStrings([...existing.continuityRisk, ...packet.continuityRisk]),
      relevanceReasons: dedupeStrings([...existing.relevanceReasons, ...packet.relevanceReasons]),
      sourceRef: existing.sourceRef ?? packet.sourceRef,
      sourceRefs: [
        ...(existing.sourceRefs ?? []),
        ...(packet.sourceRefs ?? []),
      ],
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
    }));
  }

  return Array.from(merged.values());
}

function dedupeRelationEndpoints(
  endpoints: Array<{ entityType: "character" | "faction"; entityId: number; displayName: string }>,
): Array<{ entityType: "character" | "faction"; entityId: number; displayName: string }> {
  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    const key = `${endpoint.entityType}:${endpoint.entityId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
