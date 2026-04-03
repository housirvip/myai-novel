export type IsoTimestamp = string

export type Book = {
  id: string
  title: string
  genre: string
  styleGuide: string[]
  defaultChapterWordCount: number
  chapterWordCountToleranceRatio: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Outline = {
  bookId: string
  premise: string
  theme: string
  worldview: string
  coreConflicts: string[]
  endingVision: string
  updatedAt: IsoTimestamp
}

export type Volume = {
  id: string
  bookId: string
  title: string
  goal: string
  summary: string
  chapterIds: string[]
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ChapterStatus = 'planned' | 'drafted' | 'reviewed' | 'finalized'

export type Chapter = {
  id: string
  bookId: string
  volumeId: string
  index: number
  title: string
  objective: string
  summary?: string
  plannedBeats: string[]
  status: ChapterStatus
  currentPlanVersionId?: string
  currentVersionId?: string
  draftPath?: string
  finalPath?: string
  approvedAt?: IsoTimestamp
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Character = {
  id: string
  bookId: string
  name: string
  role: string
  profile: string
  motivation: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type CharacterCurrentState = {
  bookId: string
  characterId: string
  currentLocationId?: string
  statusNotes: string[]
  updatedAt: IsoTimestamp
}

export type Item = {
  id: string
  bookId: string
  name: string
  unit: string
  type: string
  isUniqueWorldwide: boolean
  isImportant: boolean
  description: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ItemCurrentState = {
  bookId: string
  itemId: string
  ownerCharacterId?: string
  locationId?: string
  quantity: number
  status: string
  updatedAt: IsoTimestamp
}

export type ContextItemView = ItemCurrentState & {
  id: string
  name: string
  unit: string
  type: string
  description: string
  isUniqueWorldwide: boolean
  isImportant: boolean
}

export type Location = {
  id: string
  bookId: string
  name: string
  type: string
  description: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Faction = {
  id: string
  bookId: string
  name: string
  type: string
  objective: string
  description: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type Hook = {
  id: string
  bookId: string
  title: string
  sourceChapterId?: string
  description: string
  payoffExpectation: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'foreshadowed' | 'payoff-planned' | 'resolved'
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type HookCurrentState = {
  bookId: string
  hookId: string
  status: Hook['status']
  updatedByChapterId?: string
  updatedAt: IsoTimestamp
}

export type ShortTermMemory = {
  bookId: string
  chapterId: string
  summaries: string[]
  recentEvents: string[]
  updatedAt: IsoTimestamp
}

export type ObservationMemoryEntry = {
  summary: string
  sourceChapterId?: string
}

export type ObservationMemory = {
  bookId: string
  chapterId: string
  entries: ObservationMemoryEntry[]
  updatedAt: IsoTimestamp
}

export type LongTermMemoryEntry = {
  summary: string
  importance: number
  sourceChapterId?: string
}

export type LongTermMemory = {
  bookId: string
  chapterId: string
  entries: LongTermMemoryEntry[]
  updatedAt: IsoTimestamp
}

export type MemoryRecallView = {
  shortTermSummaries: string[]
  recentEvents: string[]
  observationEntries: ObservationMemoryEntry[]
  relevantLongTermEntries: LongTermMemoryEntry[]
}

export type SceneCard = {
  title: string
  purpose: string
  beats: string[]
  characterIds: string[]
  locationId?: string
  factionIds: string[]
  itemIds: string[]
}

export type HookPlan = {
  hookId: string
  action: 'hold' | 'foreshadow' | 'advance' | 'payoff'
  note: string
}

export type ChapterPlan = {
  id: string
  bookId: string
  chapterId: string
  versionId: string
  objective: string
  sceneCards: SceneCard[]
  requiredCharacterIds: string[]
  requiredLocationIds: string[]
  requiredFactionIds: string[]
  requiredItemIds: string[]
  eventOutline: string[]
  hookPlan: HookPlan[]
  statePredictions: string[]
  memoryCandidates: string[]
  createdAt: IsoTimestamp
  approvedByUser: boolean
}

export type PlanningContext = {
  book: Book
  outline: Outline
  chapter: Chapter
  volume: Volume
  previousChapter: Chapter | null
  characterStates: CharacterCurrentState[]
  importantItems: ContextItemView[]
  activeHookStates: HookCurrentState[]
  memoryRecall: MemoryRecallView
}

export type WritingContext = PlanningContext & {
  chapterPlan: ChapterPlan
}

export type ChapterDraft = {
  id: string
  bookId: string
  chapterId: string
  versionId: string
  chapterPlanId: string
  content: string
  actualWordCount: number
  createdAt: IsoTimestamp
}

export type WriteNextResult = {
  chapterId: string
  chapterStatus: 'drafted'
  draftId: string
  draftPath?: string
  actualWordCount: number
  nextAction: 'review'
}

export type WordCountCheck = {
  target: number
  actual: number
  toleranceRatio: number
  deviationRatio: number
  passed: boolean
}

export type ReviewDecision = 'pass' | 'warning' | 'needs-rewrite'

export type ClosureSuggestionSource = 'rule-based' | 'llm'

export type CharacterStateClosureSuggestion = {
  characterId: string
  nextLocationId?: string
  nextStatusNotes: string[]
  reason: string
  evidence: string[]
  source: ClosureSuggestionSource
}

export type ItemStateClosureSuggestion = {
  itemId: string
  nextOwnerCharacterId?: string
  nextLocationId?: string
  nextQuantity?: number
  nextStatus?: string
  reason: string
  evidence: string[]
  source: ClosureSuggestionSource
}

export type HookStateClosureSuggestion = {
  hookId: string
  nextStatus: Hook['status']
  actualOutcome: string
  reason: string
  evidence: string[]
  source: ClosureSuggestionSource
}

export type MemoryClosureSuggestion = {
  summary: string
  memoryScope: 'long-term' | 'short-term' | 'observation'
  reason: string
  evidence: string[]
  source: ClosureSuggestionSource
}

export type ClosureSuggestions = {
  characters: CharacterStateClosureSuggestion[]
  items: ItemStateClosureSuggestion[]
  hooks: HookStateClosureSuggestion[]
  memory: MemoryClosureSuggestion[]
}

export type ReviewReport = {
  id: string
  bookId: string
  chapterId: string
  draftId: string
  decision: ReviewDecision
  consistencyIssues: string[]
  characterIssues: string[]
  itemIssues: string[]
  memoryIssues: string[]
  pacingIssues: string[]
  hookIssues: string[]
  approvalRisk: 'low' | 'medium' | 'high'
  wordCountCheck: WordCountCheck
  newFactCandidates: string[]
  closureSuggestions: ClosureSuggestions
  revisionAdvice: string[]
  createdAt: IsoTimestamp
}

export type RewriteRequest = {
  chapterId: string
  strategy: 'full' | 'partial'
  goals: string[]
  preserveFacts: boolean
  preserveHooks: boolean
  preserveEndingBeat: boolean
}

export type ChapterRewriteValidation = {
  reviewDecision: ReviewDecision
  approvalRisk: 'low' | 'medium' | 'high'
  issueCount: number
  preservedClosureScore: number
}

export type ChapterRewrite = {
  id: string
  bookId: string
  chapterId: string
  sourceDraftId: string
  sourceReviewId: string
  versionId: string
  strategy: RewriteRequest['strategy']
  goals: string[]
  content: string
  actualWordCount: number
  validation: ChapterRewriteValidation
  createdAt: IsoTimestamp
}

export type ChapterOutput = {
  id: string
  bookId: string
  chapterId: string
  sourceType: 'draft' | 'rewrite'
  sourceId: string
  finalPath: string
  content: string
  createdAt: IsoTimestamp
}

export type StoryState = {
  bookId: string
  currentChapterId: string
  recentEvents: string[]
  updatedAt: IsoTimestamp
}

export type ApproveResult = {
  chapterId: string
  chapterStatus: 'finalized'
  versionId: string
  finalPath: string
  stateUpdated: boolean
  memoryUpdated: boolean
  hooksUpdated: boolean
  approvedAt: IsoTimestamp
  forcedApproval: boolean
}

export type UpdateTraceDetail = {
  source: 'closure-suggestion' | 'structured-text' | 'fallback'
  reason: string
  evidence: string[]
  evidenceSummary?: string
  before?: string
  after?: string
  previousValueSummary?: string
  nextValueSummary?: string
}

export type ChapterStateUpdate = {
  id: string
  bookId: string
  chapterId: string
  entityType: 'character' | 'item'
  entityId: string
  summary: string
  detail: UpdateTraceDetail
  createdAt: IsoTimestamp
}

export type ChapterMemoryUpdate = {
  id: string
  bookId: string
  chapterId: string
  memoryType: 'short-term' | 'observation' | 'long-term'
  summary: string
  detail: UpdateTraceDetail
  createdAt: IsoTimestamp
}

export type ChapterHookUpdate = {
  id: string
  bookId: string
  chapterId: string
  hookId: string
  status: Hook['status']
  summary: string
  detail: UpdateTraceDetail
  createdAt: IsoTimestamp
}

export type DropChapterMode = 'plan-only' | 'draft-only' | 'all-current'

export type DropChapterRequest = {
  chapterId: string
  dropMode: DropChapterMode
  force: boolean
  command: string
  args: string[]
  requestedAt: IsoTimestamp
}

export type DropChapterResult = {
  chapterId: string
  dropMode: DropChapterMode
  droppedPlanVersionId?: string
  droppedDraftVersionId?: string
  droppedReviewId?: string
  droppedRewriteId?: string
  previousChapterStatus: ChapterStatus
  nextChapterStatus: ChapterStatus
  timestamp: IsoTimestamp
}

export type OperationLogLevel = 'info' | 'warn' | 'error'

export type OperationLogStatus = 'success' | 'failed'

export type OperationLog = {
  runId: string
  timestamp: IsoTimestamp
  level: OperationLogLevel
  command: string
  args: string[]
  cwd: string
  bookId?: string
  chapterId?: string
  status: OperationLogStatus
  durationMs?: number
  summary: string
  detail?: Record<string, unknown>
  error?: {
    name?: string
    message: string
    stack?: string
  }
}

export type DatabaseConfig = {
  client: 'sqlite'
  filename: string
}

export type ProjectConfig = {
  database: DatabaseConfig
}

export type PromptInput = {
  system?: string
  user: string
}

export type GenerateResult = {
  text: string
}

export interface LlmAdapter {
  generateText(input: PromptInput): Promise<GenerateResult>
}
