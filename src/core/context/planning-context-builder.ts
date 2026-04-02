import type { PlanningContext } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { OutlineRepository } from '../../infra/repository/outline-repository.js'
import type { VolumeRepository } from '../../infra/repository/volume-repository.js'

export class PlanningContextBuilder {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly outlineRepository: OutlineRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly volumeRepository: VolumeRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
    private readonly memoryRepository: MemoryRepository,
    private readonly hookStateRepository: HookStateRepository,
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
    const characterStates = this.characterCurrentStateRepository.listByBookId(book.id)
    const importantItems = this.itemCurrentStateRepository.listImportantByBookId(book.id)
    const shortTermMemory = this.memoryRepository.getShortTermByBookId(book.id)
    const relevantLongTermEntries = this.memoryRepository.recallRelevantLongTermEntries(
      book.id,
      [chapter.title, chapter.objective, volume.goal, ...chapter.plannedBeats],
    )
    const activeHookStates = this.hookStateRepository.listActiveByBookId(book.id)

    return {
      book,
      outline,
      chapter,
      volume,
      previousChapter,
      characterStates,
      importantItems,
      activeHookStates,
      memoryRecall: {
        shortTermSummaries: shortTermMemory?.summaries ?? [],
        recentEvents: shortTermMemory?.recentEvents ?? [],
        relevantLongTermEntries,
      },
    }
  }
}
