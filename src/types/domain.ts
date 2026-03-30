export type ISODateString = string;

export type EntityId = string;

export type Book = {
  id: EntityId;
  title: string;
  genre: string;
  styleGuide: string[];
  defaultChapterWordCount: number;
  chapterWordCountToleranceRatio: number;
  model: ModelConfig;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ModelConfig = {
  provider: string;
  model: string;
  apiBaseUrl?: string;
  temperature?: number;
};

export type Outline = {
  premise: string;
  theme: string;
  worldview: string;
  coreConflicts: string[];
  endingVision: string;
};

export type Volume = {
  id: EntityId;
  title: string;
  goal: string;
  summary: string;
  chapterIds: EntityId[];
};

export type ChapterStatus = 'planned' | 'drafted' | 'reviewed' | 'finalized';

export type Chapter = {
  id: EntityId;
  volumeId: EntityId;
  index: number;
  title: string;
  objective: string;
  summary?: string;
  plannedBeats: string[];
  status: ChapterStatus;
  draftPath?: string;
  finalPath?: string;
};

export type Character = {
  id: EntityId;
  name: string;
  role: string;
  profile: string;
  motivation: string;
  secrets: string[];
  relationships: CharacterRelation[];
  inventory: ItemRef[];
  currentLocationId?: EntityId;
  factionMemberships: CharacterFactionMembership[];
  progression: CharacterProgression;
  statusNotes: string[];
};

export type CharacterRelation = {
  targetCharacterId: EntityId;
  type: string;
  description: string;
};

export type CharacterFactionMembership = {
  factionId: EntityId;
  roleTitle: string;
  status: string;
  notes?: string[];
};

export type CharacterProgression = {
  className: string;
  rank: string;
  abilities: CharacterAbility[];
};

export type CharacterAbility = {
  id: EntityId;
  name: string;
  category: string;
  description: string;
  rank?: string;
  constraints?: string[];
};

export type StoryState = {
  currentChapterId: EntityId;
  protagonistId: EntityId;
  locations: LocationState[];
  itemStates: ItemState[];
  activeThreads: string[];
  resolvedThreads: string[];
  recentEvents: string[];
};

export type ItemRef = {
  id: EntityId;
  name: string;
  quantity: number;
  unit: string;
  type: string;
  isUniqueWorldwide: boolean;
  status: string;
  description?: string;
};

export type ItemState = {
  id: EntityId;
  name: string;
  quantity: number;
  unit: string;
  type: string;
  isUniqueWorldwide: boolean;
  ownerCharacterId?: EntityId;
  locationId?: EntityId;
  status: string;
  description?: string;
};

export type LocationState = {
  locationId: EntityId;
  status: string;
  notes?: string[];
};

export type Location = {
  id: EntityId;
  name: string;
  type: string;
  parentRegion?: string;
  controllingFactionId?: EntityId;
  residentCharacterIds?: EntityId[];
  description: string;
  rules: string[];
  status: string;
  tags: string[];
};

export type Faction = {
  id: EntityId;
  name: string;
  type: string;
  objective: string;
  description: string;
  keyCharacterIds: EntityId[];
  memberRoles?: FactionMemberRole[];
  locationIds: EntityId[];
  allyFactionIds: EntityId[];
  rivalFactionIds: EntityId[];
  status: string;
};

export type FactionMemberRole = {
  characterId: EntityId;
  roleTitle: string;
};

export type HookPriority = 'low' | 'medium' | 'high';
export type HookStatus = 'open' | 'foreshadowed' | 'payoff-planned' | 'resolved';

export type Hook = {
  id: EntityId;
  title: string;
  sourceChapterId: EntityId;
  description: string;
  payoffExpectation: string;
  priority: HookPriority;
  status: HookStatus;
};

export type MemoryEntryType = 'fact' | 'event' | 'style' | 'relationship' | 'constraint';

export type MemoryEntry = {
  id: EntityId;
  type: MemoryEntryType;
  summary: string;
  sourceChapterId?: EntityId;
  importance: number;
  tags: string[];
  lastUsedAt?: ISODateString;
};

export type ShortTermMemory = {
  recentChapterIds: EntityId[];
  summaries: string[];
  recentEvents: string[];
  temporaryConstraints: string[];
};

export type ReviewReport = {
  consistencyIssues: string[];
  characterIssues: string[];
  pacingIssues: string[];
  hookIssues: string[];
  wordCountCheck: {
    target: number;
    actual: number;
    toleranceRatio: number;
    deviationRatio: number;
    passed: boolean;
  };
  revisionAdvice: string[];
};

export type RewriteRequest = {
  chapterId: EntityId;
  strategy: 'full' | 'partial';
  lengthPolicy?: 'keep' | 'expand-to-target' | 'shrink-to-target';
  goals: string[];
  preserveFacts: boolean;
  preserveHooks: boolean;
  preserveEndingBeat: boolean;
};

export type MarkdownSyncTarget =
  | 'book'
  | 'outline'
  | 'volumes'
  | 'chapters'
  | 'characters'
  | 'locations'
  | 'factions'
  | 'hooks'
  | 'state'
  | 'short-term-memory'
  | 'long-term-memory'
  | 'all';

export type BackupManifest = {
  backupId: string;
  createdAt: ISODateString;
  trigger: 'import-markdown';
  target: MarkdownSyncTarget;
  sourceFiles: string[];
  backedUpFiles: string[];
  restoreHint: string;
  result: 'success' | 'partial-failed' | 'failed';
  errors: string[];
};

export type BookProject = {
  book: Book;
  outline: Outline;
  volumes: Volume[];
  chapters: Chapter[];
  characters: Character[];
  locations: Location[];
  factions: Faction[];
  hooks: Hook[];
  state: StoryState;
  shortTermMemory: ShortTermMemory;
  longTermMemory: MemoryEntry[];
};
