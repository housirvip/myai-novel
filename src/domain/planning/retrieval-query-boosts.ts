import {
  hasAnyKeywordCue,
  hasAuthorityReactionQueryCue,
  hasCrossEntityConflictQueryCue,
  hasInstitutionDecisionImmutabilityQueryCue,
  hasInstitutionalQueryCue,
  hasItemContinuityQueryCue,
  hasLocationContinuityQueryCue,
  hasMembershipQueryCue,
  hasMixedConstraintQueryCue,
  hasMotivationImmutabilityQueryCue,
  hasObserverImmutabilityQueryCue,
  hasRuleQueryCue,
  hasSourceImmutabilityQueryCue,
  hasSourceObservationQueryCue,
} from "./retrieval-features.js";

export function institutionalFactionBoost(input: {
  category: string | null;
  coreGoal: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  const normalizedCategory = (input.category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  const normalizedText = [input.coreGoal, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  const hasInstitutionalCue = hasInstitutionalQueryCue(keywords);
  const hasRuleCue = hasRuleQueryCue(keywords)
    && ["秩序", "制度", "外门", "入门", "登记", "门规"].some((token) => normalizedText.includes(token));

  return hasInstitutionalCue || hasRuleCue ? 18 : 0;
}

export function authorityReactionFactionBoost(input: {
  category: string | null;
  coreGoal: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  const normalizedCategory = (input.category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  if (!hasAuthorityReactionQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.coreGoal, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["秩序", "宗门", "外门", "制度", "门规"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function institutionDecisionImmutabilityFactionBoost(input: {
  category: string | null;
  coreGoal: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  const normalizedCategory = (input.category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  if (!hasInstitutionDecisionImmutabilityQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.coreGoal, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["秩序", "处理", "外门", "制度", "门规", "核验"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function mixedConstraintFactionBoost(input: {
  category: string | null;
  coreGoal: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  const normalizedCategory = (input.category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  if (!hasMixedConstraintQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.coreGoal, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["秩序", "外门", "处理", "关系", "局势"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function crossEntityConflictFactionBoost(input: {
  category: string | null;
  coreGoal: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  const normalizedCategory = (input.category ?? "").toLowerCase();
  if (!normalizedCategory.includes("宗门")) {
    return 0;
  }

  if (!hasCrossEntityConflictQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.coreGoal, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["秩序", "关系", "制度", "外门", "局势"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function membershipCharacterBoost(input: {
  currentLocation: string | null;
  professions: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasMembershipQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.currentLocation, input.professions, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["宗", "门", "外门", "内门", "弟子", "入门"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function continuityCharacterBoost(input: {
  currentLocation: string | null;
  appendNotes: string | null;
  status: string | null;
}, keywords: string[]): number {
  if (!hasLocationContinuityQueryCue(keywords)) {
    return 0;
  }

  if (!input.currentLocation) {
    return 0;
  }

  const normalizedText = [input.currentLocation, input.appendNotes, input.status].filter(Boolean).join("\n").toLowerCase();
  return ["外门", "内门", "回廊", "山", "场", "alive"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function mixedConstraintCharacterBoost(input: {
  currentLocation: string | null;
  appendNotes: string | null;
  goal: string | null;
}, keywords: string[]): number {
  if (!hasMixedConstraintQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.currentLocation, input.appendNotes, input.goal].filter(Boolean).join("\n").toLowerCase();
  return ["外门", "场", "令", "黑铁令", "宗"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function crossEntityConflictCharacterBoost(input: {
  goal: string | null;
  background: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasCrossEntityConflictQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.goal, input.background, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["目标", "goal", "查", "调查", "黑铁令", "背叛"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function observerImmutabilityCharacterBoost(input: {
  background: string | null;
  goal: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasObserverImmutabilityQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.background, input.goal, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["观察", "怀疑", "试探"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function motivationImmutabilityCharacterBoost(input: {
  background: string | null;
  goal: string | null;
  personality: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasMotivationImmutabilityQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.background, input.goal, input.personality, input.appendNotes]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return ["goal", "目标", "查", "调查", "试探", "怀疑", "背叛"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function membershipItemBoost(input: {
  category: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!(hasMembershipQueryCue(keywords) || hasRuleQueryCue(keywords))) {
    return 0;
  }

  const normalizedText = [input.category, input.description, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["令牌", "身份", "凭证", "登记"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function continuityItemBoost(input: {
  ownerType: string;
  ownerId: number | null;
  status: string | null;
  category: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasItemContinuityQueryCue(keywords)) {
    return 0;
  }

  const hasTrackedOwnership = Boolean(input.ownerType) || input.ownerId !== null || Boolean(input.status);
  if (!hasTrackedOwnership) {
    return 0;
  }

  const normalizedText = [input.category, input.description, input.appendNotes, input.status].filter(Boolean).join("\n").toLowerCase();
  return ["令牌", "身份", "凭证", "active", "失踪", "持有"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function mixedConstraintItemBoost(input: {
  ownerType: string;
  ownerId: number | null;
  status: string | null;
  category: string | null;
  description: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasMixedConstraintQueryCue(keywords)) {
    return 0;
  }

  const hasTrackedOwnership = Boolean(input.ownerType) || input.ownerId !== null || Boolean(input.status);
  if (!hasTrackedOwnership) {
    return 0;
  }

  const normalizedText = [input.category, input.description, input.appendNotes, input.status].filter(Boolean).join("\n").toLowerCase();
  return ["令牌", "身份", "持有", "核验", "active"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function sourceObservationItemBoost(input: {
  category: string | null;
  description: string | null;
  appendNotes: string | null;
  status: string | null;
}, keywords: string[]): number {
  if (!hasSourceObservationQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.category, input.description, input.appendNotes, input.status].filter(Boolean).join("\n").toLowerCase();
  return ["令牌", "身份", "凭证", "核验", "active"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function sourceImmutabilityItemBoost(input: {
  category: string | null;
  description: string | null;
  appendNotes: string | null;
  status: string | null;
}, keywords: string[]): number {
  if (!hasSourceImmutabilityQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.category, input.description, input.appendNotes, input.status].filter(Boolean).join("\n").toLowerCase();
  return ["令牌", "身份", "凭证", "核验", "active"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function ruleWorldSettingBoost(input: {
  title: string | null;
  category: string | null;
  content: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!(hasMembershipQueryCue(keywords) || hasRuleQueryCue(keywords) || hasAnyKeywordCue(keywords, ["制度", "令牌"]))) {
    return 0;
  }

  const normalizedText = [input.title, input.category, input.content, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["规则", "制度", "登记", "令牌", "入门", "外门", "宗门"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}

export function crossEntityConflictWorldSettingBoost(input: {
  title: string | null;
  category: string | null;
  content: string | null;
  appendNotes: string | null;
}, keywords: string[]): number {
  if (!hasCrossEntityConflictQueryCue(keywords)) {
    return 0;
  }

  const normalizedText = [input.title, input.category, input.content, input.appendNotes].filter(Boolean).join("\n").toLowerCase();
  return ["规则", "制度", "关系", "令牌", "宗门"].some((token) => normalizedText.includes(token)) ? 18 : 0;
}
