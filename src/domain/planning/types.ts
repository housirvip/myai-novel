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
  source: "chapter_summary" | "risk_reminder" | "entity_state";
  label: string;
  detail: string;
  priority: number;
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
  riskReminders: string[];
  priorityContext?: RetrievedPriorityContext;
  retrievalObservability?: PlanRetrievalObservability;
  recentChanges?: RetrievedRecentChange[];
}

export interface ExtractedIntentPayload {
  intentSummary: string;
  keywords: string[];
  mustInclude: string[];
  mustAvoid: string[];
}

export interface PlanIntentConstraints {
  intentSummary?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
}
