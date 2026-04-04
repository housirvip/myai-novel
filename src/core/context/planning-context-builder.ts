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
}

function buildMemoryRecallQueryTerms(
  chapterTitle: string,
  chapterObjective: string,
  volumeGoal: string,
  plannedBeats: string[],
  activeHooks: string[],
  importantItems: string[],
): string[] {
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
