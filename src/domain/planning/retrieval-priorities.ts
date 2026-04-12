import type {
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
} from "./types.js";

const BLOCKING_ENTITY_TYPES = new Set<RetrievedFactEntityType>(["hook", "world_setting"]);

export function prioritizeFactPackets(packets: RetrievedFactPacket[]): RetrievedPriorityContext {
  const blockingConstraints: RetrievedFactPacket[] = [];
  const decisionContext: RetrievedFactPacket[] = [];
  const supportingContext: RetrievedFactPacket[] = [];
  const backgroundNoise: RetrievedFactPacket[] = [];

  for (const packet of sortPackets(packets)) {
    if (isBlockingConstraint(packet)) {
      blockingConstraints.push(packet);
      continue;
    }

    if (isDecisionContext(packet)) {
      decisionContext.push(packet);
      continue;
    }

    if (isSupportingContext(packet)) {
      supportingContext.push(packet);
      continue;
    }

    backgroundNoise.push(packet);
  }

  return {
    blockingConstraints,
    decisionContext,
    supportingContext,
    backgroundNoise,
  };
}

function isBlockingConstraint(packet: RetrievedFactPacket): boolean {
  return BLOCKING_ENTITY_TYPES.has(packet.entityType)
    || packet.scores.manualPriorityScore > 0
    || packet.scores.continuityRiskScore > 0
    || packet.continuityRisk.length > 0;
}

function isDecisionContext(packet: RetrievedFactPacket): boolean {
  return packet.scores.matchScore >= 50 || packet.scores.finalScore >= 50;
}

function isSupportingContext(packet: RetrievedFactPacket): boolean {
  return packet.scores.matchScore > 0 || packet.currentState.length > 0;
}

function sortPackets(packets: RetrievedFactPacket[]): RetrievedFactPacket[] {
  return [...packets].sort(
    (left, right) => right.scores.finalScore - left.scores.finalScore || left.entityId - right.entityId,
  );
}
