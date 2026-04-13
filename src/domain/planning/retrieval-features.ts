import type { RetrievedEntity, RetrievedFactEntityType, RetrievedFactPacket } from "./types.js";

export function hasManualPriority(packet: RetrievedFactPacket): boolean {
  return packet.scores.manualPriorityScore > 0;
}

export function hasContinuityRisk(packet: RetrievedFactPacket): boolean {
  return packet.scores.continuityRiskScore > 0 || packet.continuityRisk.length > 0;
}

export function hasMotivationSignals(packet: RetrievedFactPacket): boolean {
  if (packet.entityType !== "character") {
    return false;
  }

  if (!packet.relevanceReasons.includes("keyword_hit")) {
    return false;
  }

  const text = packet.currentState.join("\n").toLowerCase();
  return ["background=", "goal=", "personality=", "append_notes="].some((token) => text.includes(token));
}

export function hasInstitutionContext(packet: RetrievedFactPacket): boolean {
  return packet.relevanceReasons.includes("institution_context");
}

export function hasRuleIntent(packet: RetrievedFactPacket): boolean {
  if (packet.entityType !== "faction") {
    return false;
  }

  const text = packet.currentState.join("\n").toLowerCase();
  const hasInstitutionType = text.includes("category=宗门");
  const hasRuleIntent = text.includes("core_goal=维持") || text.includes("秩序") || text.includes("制度");
  return hasInstitutionType && hasRuleIntent;
}

export function hasKeywordOrStrongMatch(packet: RetrievedFactPacket, threshold = 25): boolean {
  return packet.relevanceReasons.includes("keyword_hit") || packet.scores.matchScore >= threshold;
}

export function countKeywordHits(keywords: string[], content: string): number {
  return keywords.filter((keyword) => keyword.trim() && content.includes(keyword.toLowerCase())).length;
}

export function continuityBonus(content: string, entityType: RetrievedFactEntityType): number {
  let score = 0;

  if (content.includes("current_location") || content.includes("location")) {
    score += 12;
  }
  if (content.includes("owner") || content.includes("owner_type")) {
    score += 12;
  }
  if (content.includes("relation_type") || content.includes("relation")) {
    score += 10;
  }
  if (content.includes("规则") || content.includes("制度") || content.includes("rule") || content.includes("禁忌")) {
    score += 14;
  }

  if (entityType === "world_setting") {
    score += 8;
  }
  if (entityType === "hook" && (content.includes("expected_payoff") || content.includes("target_chapter_no"))) {
    score += 10;
  }

  return score;
}

export function hasReason(entity: RetrievedEntity, reason: string): boolean {
  return (entity.reason ?? "").includes(reason);
}
