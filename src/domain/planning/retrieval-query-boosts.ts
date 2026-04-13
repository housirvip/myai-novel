import {
  hasAnyKeywordCue,
  hasAuthorityReactionQueryCue,
  hasInstitutionalQueryCue,
  hasItemContinuityQueryCue,
  hasLocationContinuityQueryCue,
  hasMembershipQueryCue,
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
