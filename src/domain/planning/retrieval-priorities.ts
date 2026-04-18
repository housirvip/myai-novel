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
  // 这里做的是“prompt 预算分层”，不是事实真假判断。
  // 同一事实包只是在不同桶里拥有不同发言权，而不是被判定为重要/不重要的绝对结论。
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
  // blockingConstraints 偏向“写错代价最高”的事实：
  // 明确手工指定、连续性高风险、或天然承担规则边界的实体，会优先进最强约束层。
  return BLOCKING_ENTITY_TYPES.has(packet.entityType)
    || hasManualPriority(packet)
    || hasContinuityRisk(packet)
    || hasCharacterStateConstraint(packet);
}

function isDecisionContext(packet: RetrievedFactPacket): boolean {
  // decisionContext 给“当前章节很可能要用来做判断”的事实。
  // 它比 supporting 更靠前，但不等于像 blocking 那样必须严格遵守。
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
  // 先按 finalScore 排，再按实体 id 稳定打平，避免 prompt 上下文顺序在重复运行时出现无意义抖动。
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
