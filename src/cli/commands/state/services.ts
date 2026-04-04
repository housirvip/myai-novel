import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../../infra/repository/character-arc-repository.js'
import { CharacterCurrentStateRepository } from '../../../infra/repository/character-current-state-repository.js'
import { CharacterRepository } from '../../../infra/repository/character-repository.js'
import { ChapterHookUpdateRepository } from '../../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../../infra/repository/chapter-memory-update-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterStateUpdateRepository } from '../../../infra/repository/chapter-state-update-repository.js'
import { EndingReadinessRepository } from '../../../infra/repository/ending-readiness-repository.js'
import { HookPressureRepository } from '../../../infra/repository/hook-pressure-repository.js'
import { HookRepository } from '../../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../../infra/repository/item-repository.js'
import { LocationRepository } from '../../../infra/repository/location-repository.js'
import { MemoryRepository } from '../../../infra/repository/memory-repository.js'
import { NarrativeDebtRepository } from '../../../infra/repository/narrative-debt-repository.js'
import { StoryStateRepository } from '../../../infra/repository/story-state-repository.js'
import { StoryThreadProgressRepository } from '../../../infra/repository/story-thread-progress-repository.js'
import { StoryThreadRepository } from '../../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

/**
 * `state` 命令域的装配与查询层。
 *
 * 这里集中封装状态查看相关的 repository 组合查询，
 * 让命令文件只保留 commander 注册与 printer 调用。
 */
export function loadStoryStateView(database: NovelDatabase): {
  book: { id: string; title: string }
  state: unknown | null
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  return {
    book,
    state: new StoryStateRepository(database).getByBookId(book.id),
  }
}

export function loadStateShowView(database: NovelDatabase): {
  book: { id: string; title: string }
  currentChapterTitle: string | null
  storyState: {
    currentChapterId?: string | null
    recentEvents: unknown[]
    updatedAt?: string | null
  } | null
  characterStates: Array<{
    characterId: string
    currentLocationId?: string | null
    statusNotes: string[]
    updatedAt: string
  }>
  characterNameById: Map<string, string>
  locationNameById: Map<string, string>
  importantItems: Array<{
    id: string
    name: string
    ownerCharacterId?: string | null
    locationId?: string | null
    quantity: number
    status: string
    updatedAt?: string | null
  }>
  hookStates: Array<{
    hookId: string
    status: string
    updatedByChapterId?: string | null
    updatedAt: string
  }>
  hookTitleById: Map<string, string>
  characterArcs: unknown
  hookPressures: unknown
  activeStoryThreads: unknown
  recentThreadProgress: unknown
  latestVolumePlans: unknown
  endingReadiness: unknown
  openNarrativeDebts: unknown
  shortTermMemory: unknown
  observationMemory: unknown
  longTermMemory: unknown
  recentStateUpdates: Array<{
    entityType: string
    entityId: string
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
  itemNameById: Map<string, string>
  recentMemoryUpdates: Array<{
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
  recentHookUpdates: Array<{
    hookId: string
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const chapters = chapterRepository.listByBookId(book.id)
  const storyState = new StoryStateRepository(database).getByBookId(book.id)
  const characterRepository = new CharacterRepository(database)
  const locationRepository = new LocationRepository(database)
  const itemRepository = new ItemRepository(database)
  const hookRepository = new HookRepository(database)
  const characterStates = new CharacterCurrentStateRepository(database).listByBookId(book.id)
  const characterArcs = new CharacterArcRepository(database).listByBookId(book.id)
  const importantItems = new ItemCurrentStateRepository(database).listImportantByBookId(book.id)
  const hookStates = new HookStateRepository(database).listByBookId(book.id)
  const hookPressures = new HookPressureRepository(database).listActiveByBookId(book.id)
  const activeStoryThreads = new StoryThreadRepository(database).listActiveByBookId(book.id)
  const recentThreadProgress = new StoryThreadProgressRepository(database).listByBookId(book.id).slice(0, 10)
  const endingReadiness = new EndingReadinessRepository(database).getByBookId(book.id)
  const latestVolumePlans = [...new Set(chapters.map((chapter) => chapter.volumeId))]
    .map((volumeId) => new VolumePlanRepository(database).getLatestByVolumeId(volumeId))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan))
  const openNarrativeDebts = new NarrativeDebtRepository(database).listOpenByBookId(book.id)
  const memoryRepository = new MemoryRepository(database)
  const shortTermMemory = memoryRepository.getShortTermByBookId(book.id)
  const observationMemory = memoryRepository.getObservationByBookId(book.id)
  const longTermMemory = memoryRepository.getLongTermByBookId(book.id)
  const characters = characterRepository.listByBookId(book.id)
  const locations = locationRepository.listByBookId(book.id)
  const items = itemRepository.listByBookId(book.id)
  const hooks = hookRepository.listByBookId(book.id)
  const recentStateUpdates = new ChapterStateUpdateRepository(database).listByBookId(book.id).slice(0, 10)
  const recentMemoryUpdates = new ChapterMemoryUpdateRepository(database).listByBookId(book.id).slice(0, 10)
  const recentHookUpdates = new ChapterHookUpdateRepository(database).listByBookId(book.id).slice(0, 10)

  const characterNameById = new Map(characters.map((character) => [character.id, character.name]))
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]))
  const itemNameById = new Map(items.map((item) => [item.id, item.name]))
  const hookTitleById = new Map(hooks.map((hook) => [hook.id, hook.title]))
  const currentChapterTitle = storyState?.currentChapterId
    ? chapterRepository.getById(storyState.currentChapterId)?.title ?? null
    : null

  return {
    book,
    currentChapterTitle,
    storyState,
    characterStates,
    characterNameById,
    locationNameById,
    importantItems,
    hookStates,
    hookTitleById,
    characterArcs,
    hookPressures,
    activeStoryThreads,
    recentThreadProgress,
    latestVolumePlans,
    endingReadiness,
    openNarrativeDebts,
    shortTermMemory,
    observationMemory,
    longTermMemory,
    recentStateUpdates,
    itemNameById,
    recentMemoryUpdates,
    recentHookUpdates,
  }
}

export function loadStateUpdatesView(database: NovelDatabase, chapterId: string): {
  chapter: { index: number; title: string; id: string; status: string; bookId: string } | null
  review: {
    id: string
    decision: string
    approvalRisk: string
    closureSuggestions: {
      characters: unknown[]
      items: unknown[]
      hooks: unknown[]
      memory: unknown[]
    }
    consistencyIssues: string[]
    characterIssues: string[]
    itemIssues: string[]
    memoryIssues: string[]
    hookIssues: string[]
    revisionAdvice: string[]
  } | null
  stateUpdates: Array<{
    entityType: string
    entityId: string
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
  memoryUpdates: Array<{
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
  hookUpdates: Array<{
    hookId: string
    detail: {
      source: string
      reason: string
      evidence: string[]
      evidenceSummary?: string
      before?: string
      after?: string
      previousValueSummary?: string
      nextValueSummary?: string
    }
    [key: string]: unknown
  }>
  characterNameById: Map<string, string>
  itemNameById: Map<string, string>
  hookTitleById: Map<string, string>
} {
  const chapterRepository = new ChapterRepository(database)
  const characterRepository = new CharacterRepository(database)
  const itemRepository = new ItemRepository(database)
  const hookRepository = new HookRepository(database)
  const chapter = chapterRepository.getById(chapterId)
  const review = new ChapterReviewRepository(database).getLatestByChapterId(chapterId)
  const stateUpdates = new ChapterStateUpdateRepository(database).listByChapterId(chapterId)
  const memoryUpdates = new ChapterMemoryUpdateRepository(database).listByChapterId(chapterId)
  const hookUpdates = new ChapterHookUpdateRepository(database).listByChapterId(chapterId)
  const characterNameById = new Map(
    characterRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]),
  )
  const itemNameById = new Map(itemRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]))
  const hookTitleById = new Map(hookRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.title]))

  return {
    chapter,
    review,
    stateUpdates,
    memoryUpdates,
    hookUpdates,
    characterNameById,
    itemNameById,
    hookTitleById,
  }
}
