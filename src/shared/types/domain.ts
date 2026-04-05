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

export type SceneGoal = {
  sceneTitle: string
  conflict: string
  informationReveal: string
  emotionalShift: string
}

export type SceneConstraint = {
  sceneTitle: string
  mustInclude: string[]
  mustAvoid: string[]
  protectedFacts: string[]
}

export type SceneEmotionalTarget = {
  sceneTitle: string
  startingEmotion: string
  targetEmotion: string
  intensity: 'low' | 'medium' | 'high'
}

export type SceneOutcomeChecklist = {
  sceneTitle: string
  mustHappen: string[]
  shouldAdvanceHooks: string[]
  shouldResolveDebts: string[]
}

export type HookPlan = {
  hookId: string
  action: 'hold' | 'foreshadow' | 'advance' | 'payoff'
  note: string
}

export type CharacterArcStage = 'setup' | 'rising' | 'crisis' | 'transform' | 'aftermath'

export type CharacterArc = {
  bookId: string
  characterId: string
  arc: string
  currentStage: CharacterArcStage
  updatedByChapterId?: string
  summary: string
  updatedAt: IsoTimestamp
}

export type HookPressure = {
  bookId: string
  hookId: string
  pressureScore: number
  riskLevel: 'low' | 'medium' | 'high'
  lastAdvancedChapterId?: string
  nextSuggestedChapterIndex?: number
  updatedAt: IsoTimestamp
}

export type NarrativePressure = {
  characterArcs: CharacterArc[]
  highPressureHooks: HookPressure[]
  openNarrativeDebts: NarrativeDebt[]
  protectedFacts: string[]
}

/**
 * 卷级滚动规划窗口，描述一次多章规划覆盖的章节范围。
 *
 * 这个结构是 `v4` 多章导演语义的基础：
 * - `windowStartChapterIndex` / `windowEndChapterIndex` 定义规划边界
 * - `focusThreadIds` 声明这段窗口内优先推进的故事线程
 * - `goal` 概括这一小段章节串需要完成的总体推进意图
 */
export type RollingPlanWindow = {
  windowStartChapterIndex: number
  windowEndChapterIndex: number
  focusThreadIds: string[]
  goal: string
}

export type ThreadStage = 'setup' | 'developing' | 'pressure' | 'turning' | 'payoff' | 'closed'

export type ThreadPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * StoryThread 表示跨多个章节持续推进的一条叙事线程。
 *
 * 它可以是主线、支线、人物线、关系线或世界线，作用是把 `v3`
 * 的局部状态压力组织成更长期的创作推进对象。
 */
export type StoryThread = {
  id: string
  bookId: string
  volumeId: string
  title: string
  threadType: 'main' | 'subplot' | 'character' | 'relationship' | 'mystery' | 'world'
  summary: string
  priority: ThreadPriority
  stage: ThreadStage
  linkedCharacterIds: string[]
  linkedHookIds: string[]
  targetOutcome: string
  status: 'active' | 'paused' | 'resolved'
  updatedByChapterId?: string
  updatedAt: IsoTimestamp
}

export type ThreadProgressStatus = 'setup' | 'advanced' | 'stalled' | 'turning' | 'payoff' | 'closed'

/**
 * ChapterThreadImpact 描述某一章对某条故事线程产生了什么类型的推进影响。
 */
export type ChapterThreadImpact = {
  threadId: string
  impactType: 'setup' | 'advance' | 'stall' | 'turn' | 'payoff'
  summary: string
}

/**
 * StoryThreadProgress 是线程推进轨迹的提交记录。
 *
 * 与 `StoryThread` 的“当前状态”不同，这里保留的是按章节累积的推进历史，
 * 方便后续 review / planning 判断一条线程是否长期停滞或偏航。
 */
export type StoryThreadProgress = {
  id: string
  bookId: string
  threadId: string
  chapterId: string
  progressStatus: ThreadProgressStatus
  summary: string
  impacts: ChapterThreadImpact[]
  createdAt: IsoTimestamp
}

export type MissionType = 'setup' | 'advance' | 'complicate' | 'stabilize' | 'foreshadow' | 'payoff'

/**
 * ChapterMission 用来回答“当前章节在卷级窗口中的职责是什么”。
 *
 * 一个章节可以承担多条线程中的某一项具体任务，但 mission 本身应是
 * 当前章可执行、可审查、可提交的单元，因此这里保留了成功信号与优先级。
 */
export type ChapterMission = {
  id: string
  bookId: string
  volumeId: string
  chapterId: string
  threadId: string
  missionType: MissionType
  summary: string
  successSignal: string
  priority: ThreadPriority
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/**
 * 终局准备要求定义“为了未来可收束，当前窗口需要提前布置什么”。
 */
export type EndingSetupRequirement = {
  id: string
  summary: string
  relatedThreadId?: string
  targetChapterIndex?: number
  status: 'pending' | 'in-progress' | 'ready' | 'fulfilled'
}

/**
 * VolumePlan 是高于 ChapterPlan 的卷级导演真源。
 *
 * 它不直接替代单章计划，而是提供未来 `3-5` 章的中程推进约束，
 * 让单章 planning 能知道自己在整段叙事中的职责位置。
 */
export type VolumePlan = {
  id: string
  bookId: string
  volumeId: string
  title: string
  focusSummary: string
  rollingWindow: RollingPlanWindow
  threadIds: string[]
  chapterMissions: ChapterMission[]
  endingSetupRequirements: EndingSetupRequirement[]
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ClosureRiskLevel = 'low' | 'medium' | 'high'

export type PayoffRequirement = {
  summary: string
  relatedThreadId?: string
  targetChapterIndex?: number
  status: 'pending' | 'ready' | 'fulfilled'
}

export type ClosureGap = {
  summary: string
  severity: ClosureRiskLevel
  relatedThreadId?: string
}

export type FinalConflictPrerequisite = {
  summary: string
  status: 'missing' | 'partial' | 'ready'
  relatedThreadId?: string
}

/**
 * EndingReadiness 是当前项目距离“可以稳定收束结局”还有多远的结构化表达。
 *
 * 它不是最终结局文本，而是对回收压力、终局前提、未补缺口的当前状态快照。
 */
export type EndingReadiness = {
  bookId: string
  targetVolumeId: string
  readinessScore: number
  closureScore: number
  pendingPayoffs: PayoffRequirement[]
  closureGaps: ClosureGap[]
  finalConflictPrerequisites: FinalConflictPrerequisite[]
  updatedAt: IsoTimestamp
}

export type CharacterFocusPriority = 'background' | 'supporting' | 'featured' | 'spotlight'

/**
 * CharacterPresenceWindow 表示角色在最近若干章节中的出场连续性。
 *
 * `missingChapterCount` 用来表达“该角色已经多少章没有被有效承接”，
 * 是 `M3` 群像平衡判断的核心信号之一。
 */
export type CharacterPresenceWindow = {
  characterId: string
  recentChapterIds: string[]
  lastSeenChapterId?: string
  missingChapterCount: number
  priority: CharacterFocusPriority
}

/**
 * 支线承接要求描述“哪条支线正在脱离读者视野，需要重新挂回正文”。
 */
export type SubplotCarryRequirement = {
  threadId: string
  summary: string
  urgency: 'low' | 'medium' | 'high'
}

/**
 * EnsembleBalanceReport 是 planning / review 共享的群像失衡摘要。
 */
export type EnsembleBalanceReport = {
  neglectedCharacterIds: string[]
  neglectedThreadIds: string[]
  suggestedReturnCharacterIds: string[]
  subplotCarryRequirements: SubplotCarryRequirement[]
}

/**
 * ChapterPlan 仍然是单章执行计划，但在 `v4` 中会逐步与卷级 mission 对齐。
 *
 * 这里保留的卷级字段承担的是“把单章写作绑回多章导演语义”的职责：
 * - `missionId` 标记当前章承接的是哪一个窗口任务
 * - `threadFocus` 声明本章必须优先推进的线程
 * - `carryInTasks` / `carryOutTasks` 约束本章前后半段的承接与交棒
 * - `ensembleFocusCharacterIds` / `subplotCarryThreadIds` 用于控制群像与支线不要长期失联
 * - `endingDrive` 表示这一章结尾必须制造的下一章牵引方向
 */
export type ChapterPlan = {
  id: string
  bookId: string
  chapterId: string
  versionId: string
  objective: string
  sceneCards: SceneCard[]
  sceneGoals: SceneGoal[]
  sceneConstraints: SceneConstraint[]
  sceneEmotionalTargets: SceneEmotionalTarget[]
  sceneOutcomeChecklist: SceneOutcomeChecklist[]
  requiredCharacterIds: string[]
  requiredLocationIds: string[]
  requiredFactionIds: string[]
  requiredItemIds: string[]
  eventOutline: string[]
  hookPlan: HookPlan[]
  statePredictions: string[]
  memoryCandidates: string[]
  highPressureHookIds: string[]
  characterArcTargets: string[]
  debtCarryTargets: string[]
  missionId?: string
  threadFocus: string[]
  windowRole?: string
  carryInTasks: string[]
  carryOutTasks: string[]
  ensembleFocusCharacterIds: string[]
  subplotCarryThreadIds: string[]
  endingDrive: string
  mustResolveDebts: string[]
  mustAdvanceHooks: string[]
  mustPreserveFacts: string[]
  createdAt: IsoTimestamp
  approvedByUser: boolean
}

export type ToneConstraint = {
  label: string
  requirement: string
}

export type NarrativeVoiceConstraint = {
  pointOfView: 'first-person' | 'third-person-limited' | 'third-person-omniscient'
  tense: 'past' | 'present'
  distance: 'close' | 'medium' | 'far'
  stabilityRequirement: string
}

export type EmotionalCurve = {
  openingEmotion: string
  midEmotion: string
  endingEmotion: string
  targetIntensity: 'low' | 'medium' | 'high'
}

/**
 * WritingQualityContract 是 generation 阶段的硬约束集合。
 *
 * 相比 `v3`，这里新增了 `volumeExecutionRules`，用于把 mission、carry、群像、结尾牵引
 * 从“可参考提示”提升为“必须兑现的执行规则”。
 */
export type WritingQualityContract = {
  sceneExecutionRules: string[]
  stateConsistencyRules: string[]
  volumeExecutionRules: string[]
  endingDriveRule: string
  proseQualityRules: string[]
}

export type PlanningContext = {
  book: Book
  outline: Outline
  chapter: Chapter
  volume: Volume
  previousChapter: Chapter | null
  characterStates: CharacterCurrentState[]
  characterArcs: CharacterArc[]
  importantItems: ContextItemView[]
  activeHookStates: HookCurrentState[]
  hookPressures: HookPressure[]
  narrativePressure: NarrativePressure
  protectedFactConstraints: string[]
  memoryRecall: MemoryRecallView
  volumePlan: VolumePlan | null
  activeStoryThreads: StoryThread[]
  currentChapterMission: ChapterMission | null
  endingReadiness: EndingReadiness | null
  characterPresenceWindows: CharacterPresenceWindow[]
  ensembleBalanceReport: EnsembleBalanceReport
}

export type WritingContext = PlanningContext & {
  chapterPlan: ChapterPlan
  sceneTasks: {
    goals: ChapterPlan['sceneGoals']
    constraints: ChapterPlan['sceneConstraints']
    emotionalTargets: ChapterPlan['sceneEmotionalTargets']
    outcomeChecklist: ChapterPlan['sceneOutcomeChecklist']
  }
  writingQualityContract: WritingQualityContract
  toneConstraints: ToneConstraint[]
  narrativeVoiceConstraint: NarrativeVoiceConstraint
  emotionalCurve: EmotionalCurve
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

export type MustFixIssue = {
  category: 'consistency' | 'state' | 'hook' | 'structure'
  severity: 'high' | 'critical'
  summary: string
}

export type NarrativeQualityIssue = {
  category: 'scene-execution' | 'pacing' | 'ending-drive' | 'emotion' | 'arc' | 'debt'
  severity: 'low' | 'medium' | 'high'
  summary: string
}

export type LanguageQualityIssue = {
  category: 'clarity' | 'style' | 'dialogue' | 'show-vs-tell'
  severity: 'low' | 'medium' | 'high'
  summary: string
}

/**
 * RewriteStrategySuggestion 是 review 对 rewrite 阶段给出的结构化策略建议。
 *
 * 在 `v4.1` 中，它已经不只覆盖通用文本修订，也会显式给出卷级修订焦点：
 * - `thread-focus`：优先修正 mission / 主线推进偏航
 * - `closure-focus`：优先修正 ending drive / payoff / 收束缺口
 * - `ensemble-balance`：优先修正人物线、关系线与支线失衡
 */
export type RewriteStrategySuggestion = {
  primary:
    | 'consistency-first'
    | 'pacing-first'
    | 'ending-drive-first'
    | 'thread-focus'
    | 'closure-focus'
    | 'ensemble-balance'
    | 'dialogue-enhance'
    | 'emotion-enhance'
    | 'length-correction'
  secondary: Array<
    | 'consistency-first'
    | 'pacing-first'
    | 'ending-drive-first'
    | 'thread-focus'
    | 'closure-focus'
    | 'ensemble-balance'
    | 'dialogue-enhance'
    | 'emotion-enhance'
    | 'length-correction'
  >
  rationale: string[]
}

export type ReviewLayers = {
  mustFix: MustFixIssue[]
  narrativeQuality: NarrativeQualityIssue[]
  languageQuality: LanguageQualityIssue[]
  rewriteStrategySuggestion: RewriteStrategySuggestion
}

/**
 * ReviewReport 不只是质量报告，也是后续 rewrite / approve 的卷级诊断输入。
 *
 * 在 `v4` / `v4.1` 中，以下字段会直接驱动后续链路：
 * - `threadIssues`：哪些高优线程没有被有效推进
 * - `endingReadinessIssues`：哪些收束缺口正在累积
 * - `missionProgress`：当前章是否完成了它的卷级 mission
 * - `reviewLayers`：为 rewrite 策略切换提供结构化依据
 */
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
  threadIssues: string[]
  endingReadinessIssues: string[]
  missionProgress: {
    missionId?: string
    missionSummary?: string
    status: 'missing' | 'partial' | 'completed' | 'not-applicable'
    evidence: string[]
  }
  reviewLayers: ReviewLayers
  approvalRisk: 'low' | 'medium' | 'high'
  wordCountCheck: WordCountCheck
  newFactCandidates: string[]
  closureSuggestions: ClosureSuggestions
  outcomeCandidate: ChapterOutcomeCandidate
  revisionAdvice: string[]
  createdAt: IsoTimestamp
}

export type ResolvedFact = {
  summary: string
  factType: 'character' | 'item' | 'hook' | 'world' | 'plot' | 'memory'
  source: 'review' | 'rewrite' | 'approve'
}

export type ObservationFact = {
  summary: string
  reason: string
  source: 'review' | 'rewrite' | 'approve'
}

export type NarrativeDebt = {
  id: string
  bookId: string
  chapterId: string
  outcomeId: string
  debtType: 'hook' | 'promise' | 'conflict' | 'emotion' | 'arc' | 'fact'
  summary: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'resolved'
  sourceReviewId?: string
  sourceRewriteId?: string
  createdAt: IsoTimestamp
  resolvedAt?: IsoTimestamp
}

export type NarrativeContradiction = {
  id: string
  bookId: string
  chapterId: string
  outcomeId: string
  contradictionType: 'world' | 'character' | 'plot' | 'fact' | 'hook'
  summary: string
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'resolved'
  sourceReviewId?: string
  sourceRewriteId?: string
  createdAt: IsoTimestamp
  resolvedAt?: IsoTimestamp
}

export type CharacterArcProgress = {
  characterId: string
  arc: string
  stage: string
  summary: string
}

export type HookDebtUpdate = {
  hookId: string
  pressure: 'low' | 'medium' | 'high'
  summary: string
}

export type ChapterOutcomeCandidate = {
  decision: ReviewDecision
  resolvedFacts: ResolvedFact[]
  observationFacts: ObservationFact[]
  contradictions: Array<Omit<NarrativeContradiction, 'id' | 'bookId' | 'chapterId' | 'outcomeId' | 'createdAt' | 'resolvedAt'>>
  narrativeDebts: Array<Omit<NarrativeDebt, 'id' | 'bookId' | 'chapterId' | 'outcomeId' | 'createdAt' | 'resolvedAt'>>
  characterArcProgress: CharacterArcProgress[]
  hookDebtUpdates: HookDebtUpdate[]
}

export type ChapterOutcome = {
  id: string
  bookId: string
  chapterId: string
  sourceReviewId?: string
  sourceRewriteId?: string
  decision: ReviewDecision
  resolvedFacts: ResolvedFact[]
  observationFacts: ObservationFact[]
  contradictions: NarrativeContradiction[]
  narrativeDebts: NarrativeDebt[]
  characterArcProgress: CharacterArcProgress[]
  hookDebtUpdates: HookDebtUpdate[]
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

export type RewriteStrategyKind =
  | 'consistency-first'
  | 'pacing-first'
  | 'ending-drive-first'
  | 'thread-focus'
  | 'closure-focus'
  | 'ensemble-balance'
  | 'dialogue-enhance'
  | 'emotion-enhance'
  | 'length-correction'

export type RewriteStrategyProfile = {
  primary: RewriteStrategyKind
  secondary: RewriteStrategyKind[]
  source: 'review-layers' | 'manual-goals' | 'fallback'
  rationale: string[]
}

export type RewriteQualityTarget = {
  preserveFacts: boolean
  preserveHooks: boolean
  preserveEndingBeat: boolean
  targetIssueReduction: number
  focusAreas: string[]
}

export type ChapterRewriteValidation = {
  reviewDecision: ReviewDecision
  approvalRisk: 'low' | 'medium' | 'high'
  issueCount: number
  preservedClosureScore: number
  strategyAligned: boolean
  targetedIssueTypes: string[]
}

export type ChapterRewrite = {
  id: string
  bookId: string
  chapterId: string
  sourceDraftId: string
  sourceReviewId: string
  versionId: string
  strategy: RewriteRequest['strategy']
  strategyProfile: RewriteStrategyProfile
  qualityTarget: RewriteQualityTarget
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

/**
 * ApproveResult 表示“章节批准后，卷级状态闭环是否已完成提交”。
 *
 * 其中 `threadProgressUpdated` 与 `endingReadinessUpdated` 是 `v4` 之后新增的关键回执，
 * 用来确认 approve 不只是生成终稿，也同步推动了长期线程与终局准备状态。
 */
export type ApproveResult = {
  chapterId: string
  chapterStatus: 'finalized'
  versionId: string
  finalPath: string
  stateUpdated: boolean
  memoryUpdated: boolean
  hooksUpdated: boolean
  threadProgressUpdated: boolean
  endingReadinessUpdated: boolean
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

export type SqliteDatabaseConfig = {
  client: 'sqlite'
  filename: string
}

export type MySqlDatabaseConfig = {
  client: 'mysql'
  host: string
  port: number
  user: string
  password?: string
  database: string
}

export type DatabaseConfig = SqliteDatabaseConfig | MySqlDatabaseConfig

export type ProjectConfig = {
  database: DatabaseConfig
}

export type LlmProvider = 'openai' | 'openai-compatible'

export type LlmTaskStage = 'planning' | 'generation' | 'review' | 'rewrite' | 'general'

export type PromptInput = {
  system?: string
  user: string
  metadata?: {
    stage?: LlmTaskStage
    providerHint?: LlmProvider
    modelHint?: string
    timeoutMs?: number
    maxRetries?: number
    traceId?: string
  }
}

export type LlmResolutionSource = 'input-hint' | 'stage-routing' | 'default-provider' | 'fallback'

export type LlmModelSource = 'input-hint' | 'stage-routing' | 'provider-default'

export type LlmExecutionMetadata = {
  stage?: LlmTaskStage
  requestedProvider?: LlmProvider
  selectedProvider: LlmProvider
  providerSource: LlmResolutionSource
  requestedModel?: string
  selectedModel: string
  modelSource: LlmModelSource
  fallbackUsed: boolean
  fallbackFromProvider?: LlmProvider
  responseId?: string
  requestId?: string
  latencyMs?: number
  finishReason?: string
  retryCount?: number
  rawUsage?: Record<string, unknown>
}

export type GenerateResult = {
  text: string
  provider: LlmProvider
  model: string
  responseId?: string
  latencyMs?: number
  metadata?: LlmExecutionMetadata
}

export interface LlmAdapter {
  readonly provider: LlmProvider
  generateText(input: PromptInput): Promise<GenerateResult>
}
