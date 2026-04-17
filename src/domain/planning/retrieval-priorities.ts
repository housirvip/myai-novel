import type {
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
} from "./types.js";
import {
  hasCharacterStateConstraint,
  hasContinuityRisk,
  hasInstitutionContext,
  hasKeywordOrStrongMatch,
  hasManualPriority,
  hasMotivationSignals,
  hasRuleIntent,
} from "./retrieval-features.js";

const BLOCKING_ENTITY_TYPES = new Set<RetrievedFactEntityType>(["hook", "world_setting"]);

export function prioritizeFactPackets(packets: RetrievedFactPacket[]): RetrievedPriorityContext {
  const blockingConstraints: RetrievedFactPacket[] = [];
  const decisionContext: RetrievedFactPacket[] = [];
  const supportingContext: RetrievedFactPacket[] = [];
  const backgroundNoise: RetrievedFactPacket[] = [];

  for (const packet of sortPackets(packets)) {
    const classification = classifyPriorityPacket(packet);

    if (classification.bucket === "blockingConstraints") {
      blockingConstraints.push(packet);
      continue;
    }

    if (classification.bucket === "decisionContext") {
      decisionContext.push(packet);
      continue;
    }

    if (classification.bucket === "supportingContext") {
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

export function classifyPriorityPacket(packet: RetrievedFactPacket): {
  bucket: keyof RetrievedPriorityContext;
  assignedBy: string[];
} {
  const assignedBy = explainPriorityPacketAssignment(packet);

  if (isBlockingConstraint(packet)) {
    return { bucket: "blockingConstraints", assignedBy };
  }

  if (isDecisionContext(packet)) {
    return { bucket: "decisionContext", assignedBy };
  }

  if (isSupportingContext(packet)) {
    return { bucket: "supportingContext", assignedBy };
  }

  return { bucket: "backgroundNoise", assignedBy: assignedBy.length > 0 ? assignedBy : ["fell_through_to_background"] };
}

function isBlockingConstraint(packet: RetrievedFactPacket): boolean {
  return BLOCKING_ENTITY_TYPES.has(packet.entityType)
    || hasManualPriority(packet)
    || hasContinuityRisk(packet)
    || hasCharacterStateConstraint(packet);
}

function isDecisionContext(packet: RetrievedFactPacket): boolean {
  return packet.scores.matchScore >= 50
    || packet.scores.finalScore >= 50
    || hasMotivationSignals(packet)
    || isRuleRelevantFaction(packet);
}

function isSupportingContext(packet: RetrievedFactPacket): boolean {
  return packet.scores.matchScore > 0 || packet.currentState.length > 0;
}

export function explainPriorityPacketAssignment(packet: RetrievedFactPacket): string[] {
  const reasons = new Set<string>();

  if (BLOCKING_ENTITY_TYPES.has(packet.entityType)) {
    reasons.add("blocking_entity_type");
  }
  if (hasManualPriority(packet)) {
    reasons.add("manual_priority");
  }
  if (hasContinuityRisk(packet)) {
    reasons.add("continuity_risk");
  }
  if (hasCharacterStateConstraint(packet)) {
    reasons.add("character_state_constraint");
  }
  if (packet.scores.matchScore >= 50) {
    reasons.add("high_match_score");
  }
  if (packet.scores.finalScore >= 50) {
    reasons.add("high_final_score");
  }
  if (hasMotivationSignals(packet)) {
    reasons.add("motivation_signal");
  }
  if (isRuleRelevantFaction(packet)) {
    reasons.add("rule_relevant_faction");
  }
  if (packet.scores.matchScore > 0 || packet.currentState.length > 0) {
    reasons.add("nonzero_match_or_state");
  }

  return Array.from(reasons);
}

function sortPackets(packets: RetrievedFactPacket[]): RetrievedFactPacket[] {
  return [...packets].sort(
    (left, right) => right.scores.finalScore - left.scores.finalScore || left.entityId - right.entityId,
  );
}

function isRuleRelevantFaction(packet: RetrievedFactPacket): boolean {
  if (packet.entityType !== "faction") {
    return false;
  }

  if (hasInstitutionContext(packet)) {
    return true;
  }

  if (!hasKeywordOrStrongMatch(packet, 25)) {
    return false;
  }

  return hasRuleIntent(packet);
}
