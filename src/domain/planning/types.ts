export interface ManualEntityRefs {
  characterIds: number[];
  factionIds: number[];
  itemIds: number[];
  hookIds: number[];
  relationIds: number[];
  worldSettingIds: number[];
}

export interface RetrievedEntity {
  id: number;
  name?: string;
  title?: string;
  reason: string;
  content: string;
  score: number;
  relationEndpoints?: Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
  relationMetadata?: {
    relationType: string;
    status?: string;
    description?: string;
    appendNotes?: string;
  };
}

export type RetrievedFactEntityType =
  | "character"
  | "faction"
  | "item"
  | "relation"
  | "hook"
  | "world_setting"
  | "chapter";

export interface RetrievedFactPacket {
  entityType: RetrievedFactEntityType;
  entityId: number;
  displayName: string;
  relatedDisplayNames?: string[];
  relationEndpoints?: Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
  relationMetadata?: {
    relationType: string;
    status?: string;
    description?: string;
    appendNotes?: string;
  };
  identity: string[];
  currentState: string[];
  coreConflictOrGoal: string[];
  recentChanges: string[];
  continuityRisk: string[];
  relevanceReasons: string[];
  sourceRef?: {
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  };
  scores: {
    matchScore: number;
    importanceScore: number;
    continuityRiskScore: number;
    recencyScore: number;
    manualPriorityScore: number;
    semanticScore?: number;
    finalScore: number;
  };
}

export type RetrievalCandidateSource = "rule" | "embedding_support" | "embedding_only";

export interface RetrievalObservedEntity {
  entityType: RetrievedFactEntityType;
  entityId: number;
  displayName: string;
  source: RetrievalCandidateSource;
  reasons: string[];
  score: number;
}

export interface RetrievalObservedHardConstraint extends RetrievalObservedEntity {
  selectedBy: string[];
}

export interface RetrievalObservedPriorityPacket extends RetrievalObservedEntity {
  bucket: keyof RetrievedPriorityContext;
  assignedBy: string[];
}

export interface PlanRetrievalObservability {
  query: {
    chapterNo: number;
    keywordCount: number;
    queryTextLength: number;
  };
  candidateVolumes: {
    beforeRerank: Record<keyof PlanRetrievedContextEntityGroups, {
      total: number;
      rule: number;
      embeddingSupport: number;
      embeddingOnly: number;
      entityType: RetrievedFactEntityType;
    }>;
    afterRerank: Record<keyof PlanRetrievedContextEntityGroups, {
      total: number;
      rule: number;
      embeddingSupport: number;
      embeddingOnly: number;
      entityType: RetrievedFactEntityType;
    }>;
    recentChaptersScanned: number;
    recentChaptersKept: number;
    outlinesKept: number;
  };
  retention: {
    hardConstraintPromotionCounts: Record<keyof PlanRetrievedContextEntityGroups, {
      promoted: number;
      leftAsSoft: number;
    }>;
    priorityBucketCounts: {
      blockingConstraints: number;
      decisionContext: number;
      supportingContext: number;
      backgroundNoise: number;
    };
  };
  persistedSidecarSelection: {
    facts: Array<{
      id: number;
      chapterNo: number | null;
      factType: string;
      rank: number | null;
      score: number;
      selected: boolean;
      droppedReason: "no_match" | "trimmed_by_top_k" | null;
      trace: {
        keywordMatched: boolean;
        structuralManualMatch: boolean;
        keywordScore: number;
        riskScore: number;
        importanceScore: number;
        recencyScore: number;
        structuralBoost: number;
      };
    }>;
    events: Array<{
      id: number;
      chapterNo: number | null;
      title: string;
      rank: number | null;
      score: number;
      selected: boolean;
      droppedReason: "no_match" | "trimmed_by_top_k" | null;
      trace: {
        keywordMatched: boolean;
        structuralManualMatch: boolean;
        keywordScore: number;
        unresolvedScore: number;
        recencyScore: number;
        structuralBoost: number;
      };
    }>;
  };
  candidates: Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedEntity[]>;
  hardConstraints: Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedHardConstraint[]>;
  priorityContext: {
    blockingConstraints: RetrievalObservedPriorityPacket[];
    decisionContext: RetrievalObservedPriorityPacket[];
    supportingContext: RetrievalObservedPriorityPacket[];
    backgroundNoise: RetrievalObservedPriorityPacket[];
  };
}

export interface RetrievedPriorityContext {
  blockingConstraints: RetrievedFactPacket[];
  decisionContext: RetrievedFactPacket[];
  supportingContext: RetrievedFactPacket[];
  backgroundNoise: RetrievedFactPacket[];
}

export interface RetrievedRecentChange {
  source: "chapter_summary" | "risk_reminder" | "entity_state" | "retrieval_fact" | "story_event";
  label: string;
  detail: string;
  priority: number;
  sourceRef?: {
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  };
  sourceRefs?: Array<{
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  }>;
}

export interface RetrievedRiskReminder {
  text: string;
  sourceRef?: {
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  };
  sourceRefs?: Array<{
    sourceType: "persisted_fact" | "persisted_event";
    sourceId: number;
  }>;
}

export interface PersistedRetrievalFact {
  id: number;
  chapterNo: number | null;
  factType: string;
  factText: string;
  importance: number | null;
  riskLevel: number | null;
  selectionTrace?: {
    score: number;
    keywordMatched: boolean;
    structuralManualMatch: boolean;
    keywordScore: number;
    riskScore: number;
    importanceScore: number;
    recencyScore: number;
    structuralBoost: number;
  };
}

export interface PersistedRetrievalFactSelectionObserved {
  id: number;
  chapterNo: number | null;
  factType: string;
  factText: string;
  rank: number | null;
  score: number;
  selected: boolean;
  droppedReason: "no_match" | "trimmed_by_top_k" | null;
  surfacedIn: Array<"blockingConstraints" | "decisionContext" | "riskReminders" | "recentChanges">;
  trace: NonNullable<PersistedRetrievalFact["selectionTrace"]>;
}

export interface PersistedStoryEvent {
  id: number;
  chapterNo: number | null;
  title: string;
  summary: string;
  unresolvedImpact: string | null;
  selectionTrace?: {
    score: number;
    keywordMatched: boolean;
    structuralManualMatch: boolean;
    keywordScore: number;
    unresolvedScore: number;
    recencyScore: number;
    structuralBoost: number;
  };
}

export interface PersistedStoryEventSelectionObserved {
  id: number;
  chapterNo: number | null;
  title: string;
  unresolvedImpact: string | null;
  rank: number | null;
  score: number;
  selected: boolean;
  droppedReason: "no_match" | "trimmed_by_top_k" | null;
  surfacedIn: Array<"blockingConstraints" | "decisionContext" | "riskReminders" | "recentChanges">;
  trace: NonNullable<PersistedStoryEvent["selectionTrace"]>;
}

export interface RetrievedOutline {
  id: number;
  title: string;
  reason: string;
  content: string;
}

export interface RetrievedChapterSummary {
  id: number;
  chapterNo: number;
  title: string | null;
  summary: string | null;
  status: string;
}

export interface PlanRetrievedContextEntityGroups {
  hooks: RetrievedEntity[];
  characters: RetrievedEntity[];
  factions: RetrievedEntity[];
  items: RetrievedEntity[];
  relations: RetrievedEntity[];
  worldSettings: RetrievedEntity[];
}

export interface PlanRetrievedContext {
  book: {
    id: number;
    title: string;
    summary: string | null;
    targetChapterCount: number | null;
    currentChapterCount: number;
  };
  outlines: RetrievedOutline[];
  recentChapters: RetrievedChapterSummary[];
  hooks: RetrievedEntity[];
  characters: RetrievedEntity[];
  factions: RetrievedEntity[];
  items: RetrievedEntity[];
  relations: RetrievedEntity[];
  worldSettings: RetrievedEntity[];
  hardConstraints: PlanRetrievedContextEntityGroups;
  softReferences: {
    outlines: RetrievedOutline[];
    recentChapters: RetrievedChapterSummary[];
    entities: PlanRetrievedContextEntityGroups;
  };
  riskReminders: RetrievedRiskReminder[];
  priorityContext?: RetrievedPriorityContext;
  retrievalObservability?: PlanRetrievalObservability;
  recentChanges?: RetrievedRecentChange[];
}

export interface ExtractedIntentPayload {
  intentSummary: string;
  keywords: string[];
  mustInclude: string[];
  mustAvoid: string[];
  entityHints: {
    characters: string[];
    factions: string[];
    items: string[];
    relations: string[];
    hooks: string[];
    worldSettings: string[];
  };
  continuityCues: string[];
  settingCues: string[];
  sceneCues: string[];
}

export interface PlanIntentConstraints {
  intentSummary?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
}
