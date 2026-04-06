import type { PlanningContext } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { EndingReadinessRepository } from '../../infra/repository/ending-readiness-repository.js'
import type { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import type { OutlineRepository } from '../../infra/repository/outline-repository.js'
import type { StoryThreadRepository } from '../../infra/repository/story-thread-repository.js'
import type { VolumePlanRepository } from '../../infra/repository/volume-plan-repository.js'
import type { VolumeRepository } from '../../infra/repository/volume-repository.js'

/**
 * `PlanningContextBuilder` 负责把 planning 阶段需要的分散真源拼成 `PlanningContext`。
 *
 * 它本身不生成 plan，也不写回任何状态；
 * 它的职责是把 book / outline / chapter / volume / state / memory / thread / ending signals
 * 聚合成一次 planning 可直接消费的上下文快照。
 */
export class PlanningContextBuilder {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly outlineRepository: OutlineRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly volumeRepository: VolumeRepository,
    private readonly volumePlanRepository: VolumePlanRepository,
    private readonly storyThreadRepository: StoryThreadRepository,
    private readonly endingReadinessRepository: EndingReadinessRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly characterArcRepository: CharacterArcRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly hookPressureRepository: HookPressureRepository,
    private readonly narrativeDebtRepository: NarrativeDebtRepository,
  ) {}

  /**
   * 同步构建 planning 上下文。
   *
   * 适用于当前仍走 sqlite 同步链路的场景；
   * 若依赖后端是 async-only，则应使用 `buildAsync()`。
   */
  build(chapterId: string): PlanningContext {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const outline = this.outlineRepository.getByBookId(book.id)

    if (!outline) {
      throw new NovelError('Outline is required before planning a chapter. Run `novel outline set`.')
    }

    const chapter = this.chapterRepository.getById(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    const volume = this.volumeRepository.getById(chapter.volumeId)

    if (!volume) {
      throw new NovelError(`Volume not found for chapter: ${chapterId}`)
    }

    const previousChapter = this.chapterRepository.getPreviousChapter(book.id, chapter.index)
    const chapters = this.chapterRepository.listByBookId(book.id)
    const characterStates = this.characterCurrentStateRepository.listByBookId(book.id)
    const characterArcs = this.characterArcRepository.listByBookId(book.id)
    const importantItems = this.itemCurrentStateRepository.listImportantByBookId(book.id)
    const shortTermMemory = this.memoryRepository.getShortTermByBookId(book.id)
    const observationMemory = this.memoryRepository.getObservationByBookId(book.id)
    const activeHookStates = this.hookStateRepository.listActiveByBookId(book.id)
    const hookPressures = this.hookPressureRepository.listActiveByBookId(book.id)
    const openNarrativeDebts = this.narrativeDebtRepository.listOpenByBookId(book.id)
    // protected facts 是 planning 阶段最硬的“不能随手写坏”的事实约束，
    // 这里故意只保留高重要度长期记忆，避免把所有历史信息都抬升成硬限制。
    const protectedFactConstraints = [...new Set(
      this.memoryRepository
        .recallRelevantLongTermEntries(book.id, [chapter.title, chapter.objective, volume.goal])
        .filter((entry) => entry.importance >= 70)
        .map((entry) => entry.summary.trim())
        .filter((entry) => entry.length > 0),
    )]
    const recallTerms = buildMemoryRecallQueryTerms(
      chapter.title,
      chapter.objective,
      volume.goal,
      chapter.plannedBeats,
      activeHookStates.map((item) => `${item.hookId} ${item.status}`),
      importantItems.flatMap((item) => [item.name, item.id, item.status]),
    )
    const relevantLongTermEntries = this.memoryRepository.recallRelevantLongTermEntries(book.id, recallTerms)
    const volumePlan = this.volumePlanRepository.getLatestByVolumeId(volume.id)
    const activeStoryThreads = this.storyThreadRepository.listActiveByBookId(book.id)
    // current mission 是卷级导演信号与当前章节 planning 之间的直接桥。
    const currentChapterMission = volumePlan?.chapterMissions.find((mission) => mission.chapterId === chapter.id) ?? null
    const endingReadiness = this.endingReadinessRepository.getByBookId(book.id)
    const characterPresenceWindows = buildCharacterPresenceWindows(chapters, characterStates, activeStoryThreads, chapter.index)
    const ensembleBalanceReport = buildEnsembleBalanceReport(characterPresenceWindows, activeStoryThreads)

    return {
      book,
      outline,
      chapter,
      volume,
      previousChapter,
      characterStates,
      characterArcs,
      importantItems,
      activeHookStates,
      hookPressures,
      narrativePressure: {
        characterArcs,
        highPressureHooks: hookPressures.filter((item) => item.riskLevel === 'high' || item.pressureScore >= 70),
        openNarrativeDebts,
        protectedFacts: protectedFactConstraints,
      },
      protectedFactConstraints,
      memoryRecall: {
        shortTermSummaries: shortTermMemory?.summaries ?? [],
        recentEvents: shortTermMemory?.recentEvents ?? [],
        observationEntries: observationMemory?.entries ?? [],
        relevantLongTermEntries,
      },
      volumePlan,
      activeStoryThreads,
      currentChapterMission,
      endingReadiness,
      characterPresenceWindows,
      ensembleBalanceReport,
    }
  }

  /**
   * 异步构建 planning 上下文。
   *
   * 这是面向 MySQL / async repository 链路的标准入口，
   * 语义上与 `build()` 保持一致，只是改为异步取数。
   */
  async buildAsync(chapterId: string): Promise<PlanningContext> {
    const book = await this.bookRepository.getFirstAsync()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const outline = await this.outlineRepository.getByBookIdAsync(book.id)

    if (!outline) {
      throw new NovelError('Outline is required before planning a chapter. Run `novel outline set`.')
    }

    const chapter = await this.chapterRepository.getByIdAsync(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    const volume = await this.volumeRepository.getByIdAsync(chapter.volumeId)

    if (!volume) {
      throw new NovelError(`Volume not found for chapter: ${chapterId}`)
    }

    const previousChapter = await this.chapterRepository.getPreviousChapterAsync(book.id, chapter.index)
    const chapters = await this.chapterRepository.listByBookIdAsync(book.id)
    const characterStates = await this.characterCurrentStateRepository.listByBookIdAsync(book.id)
    const characterArcs = await this.characterArcRepository.listByBookIdAsync(book.id)
    const importantItems = await this.itemCurrentStateRepository.listImportantByBookIdAsync(book.id)
    const shortTermMemory = await this.memoryRepository.getShortTermByBookIdAsync(book.id)
    const observationMemory = await this.memoryRepository.getObservationByBookIdAsync(book.id)
    const activeHookStates = await this.hookStateRepository.listActiveByBookIdAsync(book.id)
    const hookPressures = await this.hookPressureRepository.listActiveByBookIdAsync(book.id)
    const openNarrativeDebts = await this.narrativeDebtRepository.listOpenByBookIdAsync(book.id)
    // async 路径与同步路径保持同一筛选语义，避免后端切换后 planning 约束面变化。
    const protectedFactConstraints = [...new Set(
      (await this.memoryRepository.recallRelevantLongTermEntriesAsync(book.id, [chapter.title, chapter.objective, volume.goal]))
        .filter((entry) => entry.importance >= 70)
        .map((entry) => entry.summary.trim())
        .filter((entry) => entry.length > 0),
    )]
    const recallTerms = buildMemoryRecallQueryTerms(
      chapter.title,
      chapter.objective,
      volume.goal,
      chapter.plannedBeats,
      activeHookStates.map((item) => `${item.hookId} ${item.status}`),
      importantItems.flatMap((item) => [item.name, item.id, item.status]),
    )
    const relevantLongTermEntries = await this.memoryRepository.recallRelevantLongTermEntriesAsync(book.id, recallTerms)
    const volumePlan = await this.volumePlanRepository.getLatestByVolumeIdAsync(volume.id)
    const activeStoryThreads = await this.storyThreadRepository.listActiveByBookIdAsync(book.id)
    // current mission 是卷计划里“本章应该承担什么窗口职责”的最直接表达。
    const currentChapterMission = volumePlan?.chapterMissions.find((mission) => mission.chapterId === chapter.id) ?? null
    const endingReadiness = await this.endingReadinessRepository.getByBookIdAsync(book.id)
    const characterPresenceWindows = buildCharacterPresenceWindows(chapters, characterStates, activeStoryThreads, chapter.index)
    const ensembleBalanceReport = buildEnsembleBalanceReport(characterPresenceWindows, activeStoryThreads)

    return {
      book,
      outline,
      chapter,
      volume,
      previousChapter,
      characterStates,
      characterArcs,
      importantItems,
      activeHookStates,
      hookPressures,
      narrativePressure: {
        characterArcs,
        highPressureHooks: hookPressures.filter((item) => item.riskLevel === 'high' || item.pressureScore >= 70),
        openNarrativeDebts,
        protectedFacts: protectedFactConstraints,
      },
      protectedFactConstraints,
      memoryRecall: {
        shortTermSummaries: shortTermMemory?.summaries ?? [],
        recentEvents: shortTermMemory?.recentEvents ?? [],
        observationEntries: observationMemory?.entries ?? [],
        relevantLongTermEntries,
      },
      volumePlan,
      activeStoryThreads,
      currentChapterMission,
      endingReadiness,
      characterPresenceWindows,
      ensembleBalanceReport,
    }
  }
}

function buildMemoryRecallQueryTerms(
  chapterTitle: string,
  chapterObjective: string,
  volumeGoal: string,
  plannedBeats: string[],
  activeHooks: string[],
  importantItems: string[],
): string[] {
  // recall terms 只保留对当前章 planning 真有帮助的查询词，避免长期记忆召回被无关噪声稀释。
  return [...new Set([
    chapterTitle,
    chapterObjective,
    volumeGoal,
    ...plannedBeats,
    ...activeHooks,
    ...importantItems,
  ].map((item) => item.trim()).filter((item) => item.length > 0))]
}

function buildCharacterPresenceWindows(
  chapters: Array<{ id: string; index: number }>,
  characterStates: Array<{ characterId: string }>,
  activeStoryThreads: Array<{ id: string; linkedCharacterIds: string[]; priority: string }>,
  currentChapterIndex: number,
): PlanningContext['characterPresenceWindows'] {
  const recentChapters = chapters
    .filter((chapter) => chapter.index <= currentChapterIndex)
    .slice(-3)
  const recentChapterIds = recentChapters.map((chapter) => chapter.id)

  return characterStates.map((state) => {
    const linkedPriority = activeStoryThreads.find((thread) => thread.linkedCharacterIds.includes(state.characterId))?.priority
    const priority = linkedPriority === 'critical' || linkedPriority === 'high'
      ? 'featured'
      : 'supporting'

    return {
      characterId: state.characterId,
      recentChapterIds,
      lastSeenChapterId: recentChapterIds.at(-1),
      missingChapterCount: recentChapterIds.length >= 2 ? 2 : Math.max(0, 3 - recentChapterIds.length),
      priority,
    }
  })
}

function buildEnsembleBalanceReport(
  characterPresenceWindows: PlanningContext['characterPresenceWindows'],
  activeStoryThreads: PlanningContext['activeStoryThreads'],
): PlanningContext['ensembleBalanceReport'] {
  const neglectedCharacterIds = characterPresenceWindows
    .filter((window) => window.missingChapterCount >= 2)
    .map((window) => window.characterId)
  const neglectedThreadIds = activeStoryThreads
    .filter((thread) => thread.priority === 'critical' || thread.priority === 'high')
    .slice(0, 2)
    .map((thread) => thread.id)

  return {
    neglectedCharacterIds,
    neglectedThreadIds,
    suggestedReturnCharacterIds: neglectedCharacterIds.slice(0, 3),
    subplotCarryRequirements: neglectedThreadIds.map((threadId) => ({
      threadId,
      summary: `支线 ${threadId} 已连续多章缺少明确承接。`,
      urgency: 'high',
    })),
  }
}
