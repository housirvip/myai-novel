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
import { VolumeRepository } from '../../../infra/repository/volume-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

type TraceDetail = {
  source: string
  reason: string
  evidence: string[]
  evidenceSummary?: string
  before?: string
  after?: string
  previousValueSummary?: string
  nextValueSummary?: string
}

type StateUpdateView = {
  entityType: string
  entityId: string
  detail: TraceDetail
  [key: string]: unknown
}

type MemoryUpdateView = {
  detail: TraceDetail
  [key: string]: unknown
}

type HookUpdateView = {
  hookId: string
  detail: TraceDetail
  [key: string]: unknown
}

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

export async function loadStoryStateViewAsync(database: NovelDatabase): Promise<{
  book: { id: string; title: string }
  state: unknown | null
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  return {
    book,
    state: await new StoryStateRepository(database).getByBookIdAsync(book.id),
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
  recentStateUpdates: StateUpdateView[]
  itemNameById: Map<string, string>
  recentMemoryUpdates: MemoryUpdateView[]
  recentHookUpdates: HookUpdateView[]
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
  const recentStateUpdates = new ChapterStateUpdateRepository(database).listByBookId(book.id).slice(0, 10) as StateUpdateView[]
  const recentMemoryUpdates = new ChapterMemoryUpdateRepository(database).listByBookId(book.id).slice(0, 10) as MemoryUpdateView[]
  const recentHookUpdates = new ChapterHookUpdateRepository(database).listByBookId(book.id).slice(0, 10) as HookUpdateView[]

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

export async function loadStateShowViewAsync(database: NovelDatabase): Promise<{
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
  recentStateUpdates: StateUpdateView[]
  itemNameById: Map<string, string>
  recentMemoryUpdates: MemoryUpdateView[]
  recentHookUpdates: HookUpdateView[]
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const chapters = await chapterRepository.listByBookIdAsync(book.id)
  const storyState = await new StoryStateRepository(database).getByBookIdAsync(book.id)
  const characterRepository = new CharacterRepository(database)
  const locationRepository = new LocationRepository(database)
  const itemRepository = new ItemRepository(database)
  const hookRepository = new HookRepository(database)
  const characterStates = await new CharacterCurrentStateRepository(database).listByBookIdAsync(book.id)
  const characterArcs = await new CharacterArcRepository(database).listByBookIdAsync(book.id)
  const importantItems = await new ItemCurrentStateRepository(database).listImportantByBookIdAsync(book.id)
  const hookStates = await new HookStateRepository(database).listByBookIdAsync(book.id)
  const hookPressures = await new HookPressureRepository(database).listActiveByBookIdAsync(book.id)
  const activeStoryThreads = await new StoryThreadRepository(database).listActiveByBookIdAsync(book.id)
  const recentThreadProgress = (await new StoryThreadProgressRepository(database).listByBookIdAsync(book.id)).slice(0, 10)
  const endingReadiness = await new EndingReadinessRepository(database).getByBookIdAsync(book.id)
  const latestVolumePlans = (await Promise.all(
    [...new Set(chapters.map((chapter) => chapter.volumeId))]
      .map((volumeId) => new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId)),
  )).filter((plan): plan is NonNullable<typeof plan> => Boolean(plan))
  const openNarrativeDebts = await new NarrativeDebtRepository(database).listOpenByBookIdAsync(book.id)
  const memoryRepository = new MemoryRepository(database)
  const shortTermMemory = await memoryRepository.getShortTermByBookIdAsync(book.id)
  const observationMemory = await memoryRepository.getObservationByBookIdAsync(book.id)
  const longTermMemory = await memoryRepository.getLongTermByBookIdAsync(book.id)
  const characters = await characterRepository.listByBookIdAsync(book.id)
  const locations = await locationRepository.listByBookIdAsync(book.id)
  const items = await itemRepository.listByBookIdAsync(book.id)
  const hooks = await hookRepository.listByBookIdAsync(book.id)
  const recentStateUpdates = (await new ChapterStateUpdateRepository(database).listByBookIdAsync(book.id)).slice(0, 10) as StateUpdateView[]
  const recentMemoryUpdates = (await new ChapterMemoryUpdateRepository(database).listByBookIdAsync(book.id)).slice(0, 10) as MemoryUpdateView[]
  const recentHookUpdates = (await new ChapterHookUpdateRepository(database).listByBookIdAsync(book.id)).slice(0, 10) as HookUpdateView[]

  const characterNameById = new Map(characters.map((character) => [character.id, character.name]))
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]))
  const itemNameById = new Map(items.map((item) => [item.id, item.name]))
  const hookTitleById = new Map(hooks.map((hook) => [hook.id, hook.title]))
  const currentChapterTitle = storyState?.currentChapterId
    ? (await chapterRepository.getByIdAsync(storyState.currentChapterId))?.title ?? null
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
  stateUpdates: StateUpdateView[]
  memoryUpdates: MemoryUpdateView[]
  hookUpdates: HookUpdateView[]
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
  const stateUpdates = new ChapterStateUpdateRepository(database).listByChapterId(chapterId) as StateUpdateView[]
  const memoryUpdates = new ChapterMemoryUpdateRepository(database).listByChapterId(chapterId) as MemoryUpdateView[]
  const hookUpdates = new ChapterHookUpdateRepository(database).listByChapterId(chapterId) as HookUpdateView[]
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

export async function loadStateUpdatesViewAsync(database: NovelDatabase, chapterId: string): Promise<{
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
  stateUpdates: StateUpdateView[]
  memoryUpdates: MemoryUpdateView[]
  hookUpdates: HookUpdateView[]
  characterNameById: Map<string, string>
  itemNameById: Map<string, string>
  hookTitleById: Map<string, string>
}> {
  const chapterRepository = new ChapterRepository(database)
  const characterRepository = new CharacterRepository(database)
  const itemRepository = new ItemRepository(database)
  const hookRepository = new HookRepository(database)
  const chapter = await chapterRepository.getByIdAsync(chapterId)
  const review = await new ChapterReviewRepository(database).getLatestByChapterIdAsync(chapterId)
  const stateUpdates = await new ChapterStateUpdateRepository(database).listByChapterIdAsync(chapterId) as StateUpdateView[]
  const memoryUpdates = await new ChapterMemoryUpdateRepository(database).listByChapterIdAsync(chapterId) as MemoryUpdateView[]
  const hookUpdates = await new ChapterHookUpdateRepository(database).listByChapterIdAsync(chapterId) as HookUpdateView[]
  const characterNameById = new Map(
    (await characterRepository.listByBookIdAsync(chapter?.bookId ?? '')).map((item) => [item.id, item.name]),
  )
  const itemNameById = new Map((await itemRepository.listByBookIdAsync(chapter?.bookId ?? '')).map((item) => [item.id, item.name]))
  const hookTitleById = new Map((await hookRepository.listByBookIdAsync(chapter?.bookId ?? '')).map((item) => [item.id, item.title]))

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

export function loadStateThreadsView(database: NovelDatabase, volumeId?: string): {
  book: { id: string; title: string }
  volume: { id: string; title: string } | null
  activeThreads: unknown[]
  recentProgress: unknown[]
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = volumeId ? new VolumeRepository(database).getById(volumeId) : null

  if (volumeId && !volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const activeThreads = volumeId
    ? new StoryThreadRepository(database).listByVolumeId(volumeId)
    : new StoryThreadRepository(database).listActiveByBookId(book.id)
  const recentProgress = new StoryThreadProgressRepository(database)
    .listByBookId(book.id)
    .filter((progress) => !volumeId || activeThreads.some((thread) => (thread as { id: string }).id === progress.threadId))
    .slice(0, 10)

  return {
    book,
    volume: volume ? { id: volume.id, title: volume.title } : null,
    activeThreads,
    recentProgress,
  }
}

export async function loadStateThreadsViewAsync(database: NovelDatabase, volumeId?: string): Promise<{
  book: { id: string; title: string }
  volume: { id: string; title: string } | null
  activeThreads: unknown[]
  recentProgress: unknown[]
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = volumeId ? await new VolumeRepository(database).getByIdAsync(volumeId) : null

  if (volumeId && !volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const activeThreads = volumeId
    ? await new StoryThreadRepository(database).listByVolumeIdAsync(volumeId)
    : await new StoryThreadRepository(database).listActiveByBookIdAsync(book.id)
  const recentProgress = (await new StoryThreadProgressRepository(database)
    .listByBookIdAsync(book.id))
    .filter((progress) => !volumeId || activeThreads.some((thread) => (thread as { id: string }).id === progress.threadId))
    .slice(0, 10)

  return {
    book,
    volume: volume ? { id: volume.id, title: volume.title } : null,
    activeThreads,
    recentProgress,
  }
}

export function loadStateEndingView(database: NovelDatabase): {
  book: { id: string; title: string }
  endingReadiness: unknown | null
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  return {
    book,
    endingReadiness: new EndingReadinessRepository(database).getByBookId(book.id),
  }
}

export async function loadStateEndingViewAsync(database: NovelDatabase): Promise<{
  book: { id: string; title: string }
  endingReadiness: unknown | null
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  return {
    book,
    endingReadiness: await new EndingReadinessRepository(database).getByBookIdAsync(book.id),
  }
}

export function loadStateVolumePlanView(database: NovelDatabase, volumeId: string): {
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
  }
  latestVolumePlan: unknown | null
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = new VolumeRepository(database).getById(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  return {
    book,
    volume,
    latestVolumePlan: new VolumePlanRepository(database).getLatestByVolumeId(volumeId),
  }
}

export async function loadStateVolumePlanViewAsync(database: NovelDatabase, volumeId: string): Promise<{
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
  }
  latestVolumePlan: unknown | null
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = await new VolumeRepository(database).getByIdAsync(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  return {
    book,
    volume,
    latestVolumePlan: await new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId),
  }
}
