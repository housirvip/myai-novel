import type {
  Book,
  Chapter,
  ChapterDraft,
  ChapterPlan,
  ChapterRewrite,
  EndingReadiness,
  Outline,
  ReviewReport,
  StoryThread,
  StoryThreadProgress,
  Volume,
  VolumePlan,
} from '../../src/shared/types/domain.js'

// 这些 fixture 提供的是“最小但完整”的 v6 主链样本：
// 默认值会尽量落在同一套 book/chapter/volume/thread 命名上，方便不同测试自由拼装。
export function createBookFixture(overrides?: Partial<Book>): Book {
  return {
    id: 'book-1',
    title: '测试小说',
    genre: 'fantasy',
    styleGuide: ['紧张', '克制'],
    defaultChapterWordCount: 2200,
    chapterWordCountToleranceRatio: 0.2,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createChapterPlanFixture(overrides?: Partial<ChapterPlan>): ChapterPlan {
  // chapter plan fixture 会尽量覆盖 planning/generation/review 常用字段，避免测试里反复手填大对象。
  return {
    id: 'plan-1',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    versionId: 'plan-version-1',
    objective: '查明敌营动向',
    sceneCards: [
      {
        title: '开场铺垫',
        purpose: '建立目标与冲突',
        beats: ['潜入据点', '观察守卫'],
        characterIds: ['hero'],
        factionIds: [],
        itemIds: ['map'],
        locationId: 'fortress',
      },
    ],
    sceneGoals: [{ sceneTitle: '开场铺垫', conflict: '潜入敌营', informationReveal: '发现守卫异常', emotionalShift: '从谨慎到紧张' }],
    sceneConstraints: [{ sceneTitle: '开场铺垫', mustInclude: ['潜入'], mustAvoid: ['空泛解释'], protectedFacts: ['角色 hero 必须仍在 fortress'] }],
    sceneEmotionalTargets: [{ sceneTitle: '开场铺垫', startingEmotion: '谨慎', targetEmotion: '紧张', intensity: 'medium' }],
    sceneOutcomeChecklist: [{ sceneTitle: '开场铺垫', mustHappen: ['进入据点'], shouldAdvanceHooks: ['hook-1'], shouldResolveDebts: [] }],
    requiredCharacterIds: ['hero'],
    requiredLocationIds: ['fortress'],
    requiredFactionIds: [],
    requiredItemIds: ['map'],
    eventOutline: ['潜入据点', '发现密信'],
    hookPlan: [{ hookId: 'hook-1', action: 'advance', note: '推进旧谜团' }],
    statePredictions: ['hero：获得新线索'],
    memoryCandidates: ['敌营异动'],
    highPressureHookIds: ['hook-1'],
    characterArcTargets: ['hero:成长:怀疑'],
    debtCarryTargets: ['promise：兑现旧约'],
    missionId: 'mission-1',
    threadFocus: ['thread-1'],
    windowRole: 'advance',
    carryInTasks: ['承接前夜局势'],
    carryOutTasks: ['把线索交棒到下一章'],
    ensembleFocusCharacterIds: ['hero'],
    subplotCarryThreadIds: ['subplot-1'],
    endingDrive: '章末抛出新悬念',
    mustResolveDebts: ['promise：兑现旧约'],
    mustAdvanceHooks: ['hook-1'],
    mustPreserveFacts: ['角色 hero 必须仍在 fortress'],
    llmMetadata: {
      selectedProvider: 'openai',
      providerSource: 'default-provider',
      selectedModel: 'gpt-openai',
      modelSource: 'provider-default',
      fallbackUsed: false,
    },
    createdAt: '2026-04-06T00:00:00.000Z',
    approvedByUser: false,
    ...overrides,
  }
}

export function createChapterDraftFixture(overrides?: Partial<ChapterDraft>): ChapterDraft {
  return {
    id: 'draft-1',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    versionId: 'draft-version-1',
    chapterPlanId: 'plan-1',
    content: '正文草稿内容',
    actualWordCount: 1234,
    llmMetadata: {
      selectedProvider: 'openai',
      providerSource: 'default-provider',
      selectedModel: 'gpt-openai',
      modelSource: 'provider-default',
      fallbackUsed: false,
    },
    createdAt: '2026-04-06T00:05:00.000Z',
    ...overrides,
  }
}

export function createReviewReportFixture(overrides?: Partial<ReviewReport>): ReviewReport {
  // review fixture 默认给出 warning 级结果，适合覆盖 rewrite / approve / state-updates 等后续链路。
  return {
    id: 'review-1',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    draftId: 'draft-1',
    decision: 'warning',
    consistencyIssues: ['设定冲突'],
    characterIssues: ['角色状态偏移'],
    itemIssues: ['关键物品状态未承接'],
    memoryIssues: ['长期记忆未承接'],
    pacingIssues: ['节奏偏慢'],
    hookIssues: ['Hook 未推进'],
    threadIssues: [],
    endingReadinessIssues: [],
    missionProgress: {
      status: 'not-applicable',
      evidence: [],
    },
    reviewLayers: {
      mustFix: [{ category: 'consistency', severity: 'critical', summary: '设定冲突' }],
      narrativeQuality: [{ category: 'pacing', severity: 'medium', summary: '节奏偏慢' }],
      languageQuality: [{ category: 'style', severity: 'low', summary: '可进一步润色' }],
      rewriteStrategySuggestion: {
        primary: 'consistency-first',
        secondary: ['pacing-first'],
        rationale: ['先修一致性，再修节奏。'],
      },
    },
    approvalRisk: 'medium',
    wordCountCheck: {
      target: 2200,
      actual: 1234,
      toleranceRatio: 0.2,
      deviationRatio: 0.44,
      passed: false,
    },
    newFactCandidates: ['敌营异动'],
    closureSuggestions: {
      characters: [],
      items: [],
      hooks: [],
      memory: [],
    },
    outcomeCandidate: {
      decision: 'warning',
      resolvedFacts: [],
      observationFacts: [],
      contradictions: [],
      narrativeDebts: [],
      characterArcProgress: [],
      hookDebtUpdates: [],
    },
    llmMetadata: {
      selectedProvider: 'openai',
      providerSource: 'default-provider',
      selectedModel: 'gpt-openai',
      modelSource: 'provider-default',
      fallbackUsed: false,
    },
    revisionAdvice: ['补强结尾推进'],
    createdAt: '2026-04-06T00:10:00.000Z',
    ...overrides,
  }
}

export function createChapterRewriteFixture(overrides?: Partial<ChapterRewrite>): ChapterRewrite {
  return {
    id: 'rewrite-1',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    sourceDraftId: 'draft-1',
    sourceReviewId: 'review-1',
    versionId: 'rewrite-version-1',
    strategy: 'partial',
    strategyProfile: {
      primary: 'consistency-first',
      secondary: ['pacing-first'],
      source: 'review-layers',
      rationale: ['先修一致性，再修节奏。'],
    },
    qualityTarget: {
      preserveFacts: true,
      preserveHooks: true,
      preserveEndingBeat: true,
      targetIssueReduction: 70,
      focusAreas: ['consistency-first', 'pacing-first'],
    },
    goals: ['补强结尾'],
    content: '重写后的章节正文',
    actualWordCount: 1400,
    validation: {
      reviewDecision: 'warning',
      approvalRisk: 'medium',
      issueCount: 3,
      preservedClosureScore: 100,
      strategyAligned: true,
      targetedIssueTypes: ['consistency', 'pacing'],
    },
    llmMetadata: {
      selectedProvider: 'openai',
      providerSource: 'default-provider',
      selectedModel: 'gpt-openai',
      modelSource: 'provider-default',
      fallbackUsed: false,
    },
    createdAt: '2026-04-06T00:15:00.000Z',
    ...overrides,
  }
}

export function createVolumePlanFixture(overrides?: Partial<VolumePlan>): VolumePlan {
  // volume plan fixture 默认只放一条 mission，保持最小可读，同时足够支撑 mission/window 测试。
  return {
    id: 'volume-plan-1',
    bookId: 'book-1',
    volumeId: 'volume-1',
    title: '第一卷滚动窗口计划',
    focusSummary: '围绕卷目标持续推进',
    rollingWindow: {
      windowStartChapterIndex: 1,
      windowEndChapterIndex: 3,
      focusThreadIds: ['thread-1'],
      goal: '在三章窗口内持续推进王城线',
    },
    threadIds: ['thread-1'],
    chapterMissions: [
      {
        id: 'mission-1',
        bookId: 'book-1',
        volumeId: 'volume-1',
        chapterId: 'chapter-1',
        threadId: 'thread-1',
        missionType: 'advance',
        summary: '推进王城线',
        successSignal: '至少推进一条卷级线程',
        priority: 'high',
        createdAt: '2026-04-06T00:00:00.000Z',
        updatedAt: '2026-04-06T00:00:00.000Z',
      },
    ],
    endingSetupRequirements: [
      {
        id: 'ending-req-1',
        summary: '补足终局伏笔',
        relatedThreadId: 'thread-1',
        targetChapterIndex: 3,
        status: 'pending',
      },
    ],
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createVolumeFixture(overrides?: Partial<Volume>): Volume {
  return {
    id: 'volume-1',
    bookId: 'book-1',
    title: '第一卷',
    goal: '逼近真相',
    summary: '卷摘要',
    chapterIds: ['chapter-1'],
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createOutlineFixture(overrides?: Partial<Outline>): Outline {
  return {
    bookId: 'book-1',
    premise: '少年卷入阴谋',
    theme: '命运',
    worldview: '王城与边境对峙的高压世界',
    coreConflicts: ['王城阴谋', '身份危机'],
    endingVision: '主角逼近真相并做出代价选择',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createStoryThreadProgressFixture(overrides?: Partial<StoryThreadProgress>): StoryThreadProgress {
  return {
    id: 'thread-progress-1',
    bookId: 'book-1',
    threadId: 'thread-1',
    chapterId: 'chapter-1',
    progressStatus: 'advanced',
    summary: '王城线获得新证据',
    impacts: [
      {
        threadId: 'thread-1',
        impactType: 'advance',
        summary: '主线向前推进',
      },
    ],
    createdAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createChapterFixture(overrides?: Partial<Chapter>): Chapter {
  return {
    id: 'chapter-1',
    bookId: 'book-1',
    volumeId: 'volume-1',
    index: 1,
    title: '暗潮',
    objective: '查明敌营动向',
    summary: undefined,
    plannedBeats: ['潜入据点', '发现密信'],
    status: 'planned',
    currentPlanVersionId: undefined,
    currentVersionId: undefined,
    draftPath: undefined,
    finalPath: undefined,
    approvedAt: undefined,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createStoryThreadFixture(overrides?: Partial<StoryThread>): StoryThread {
  // 默认线程是 active/high/main，便于直接用于 planning/state/doctor 相关视图测试。
  return {
    id: 'thread-1',
    bookId: 'book-1',
    volumeId: 'volume-1',
    title: '王城线',
    threadType: 'main',
    summary: '围绕王城阴谋持续推进',
    priority: 'high',
    stage: 'developing',
    linkedCharacterIds: [],
    linkedHookIds: [],
    targetOutcome: '逼近真相',
    status: 'active',
    updatedByChapterId: 'chapter-1',
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}

export function createEndingReadinessFixture(overrides?: Partial<EndingReadiness>): EndingReadiness {
  return {
    bookId: 'book-1',
    targetVolumeId: 'volume-1',
    readinessScore: 65,
    closureScore: 55,
    pendingPayoffs: [
      {
        summary: '回收王城线伏笔',
        relatedThreadId: 'thread-1',
        targetChapterIndex: 3,
        status: 'pending',
      },
    ],
    closureGaps: [
      {
        summary: '终局伏笔不足',
        severity: 'high',
        relatedThreadId: 'thread-1',
      },
    ],
    finalConflictPrerequisites: [
      {
        summary: '主角必须掌握关键真相',
        status: 'partial',
        relatedThreadId: 'thread-1',
      },
    ],
    updatedAt: '2026-04-06T00:00:00.000Z',
    ...overrides,
  }
}
