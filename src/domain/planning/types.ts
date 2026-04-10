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
  riskReminders: string[];
}

export interface ExtractedIntentPayload {
  intentSummary: string;
  keywords: string[];
  mustInclude: string[];
  mustAvoid: string[];
}
