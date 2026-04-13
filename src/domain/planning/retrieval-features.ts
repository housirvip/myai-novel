import type { RetrievedEntity, RetrievedFactEntityType, RetrievedFactPacket } from "./types.js";

export function hasAnyKeywordCue(keywords: string[], cues: string[]): boolean {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return normalizedKeywords.some((keyword) => cues.some((token) => keyword.includes(token)));
}

export function hasInstitutionalQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["执事", "长老", "内门", "外门", "宗门", "入宗", "成员", "关系"]);
}

export function hasRuleQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["规则", "制度", "登记", "令牌"]);
}

export function hasAuthorityReactionQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["身份", "异常", "反应", "核验", "执事"]);
}

export function hasMembershipQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["入宗", "成员", "关系"]);
}

export function hasLocationContinuityQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["位置", "场景", "承接", "换场", "突然"]);
}

export function hasItemContinuityQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["易主", "失踪", "连续", "恢复"]);
}

export function hasSourceObservationQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["来源", "来历"])
    && hasAnyKeywordCue(keywords, ["观察", "怀疑", "试探"])
    && hasAnyKeywordCue(keywords, ["宗门", "执事", "核验"]);
}

export function hasSourceImmutabilityQueryCue(keywords: string[]): boolean {
  return hasAnyKeywordCue(keywords, ["禁止", "不要", "改写", "覆盖"])
    && hasAnyKeywordCue(keywords, ["来源", "来历"]);
}

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
