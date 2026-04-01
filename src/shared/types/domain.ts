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

export type DatabaseConfig = {
  client: 'sqlite'
  filename: string
}

export type ProjectConfig = {
  database: DatabaseConfig
}
