export type IsoTimestamp = string

export type ModelConfig = {
  provider: string
  modelName: string
  temperature?: number
  maxTokens?: number
}

export type Book = {
  id: string
  title: string
  genre: string
  styleGuide: string[]
  defaultChapterWordCount: number
  chapterWordCountToleranceRatio: number
  model: ModelConfig
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

export type ReviewReport = {
  id: string
  bookId: string
  chapterId: string
  draftId: string
  decision: ReviewDecision
  consistencyIssues: string[]
  characterIssues: string[]
  pacingIssues: string[]
  hookIssues: string[]
  wordCountCheck: WordCountCheck
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
