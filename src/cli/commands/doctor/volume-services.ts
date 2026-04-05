import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { EndingReadinessRepository } from '../../../infra/repository/ending-readiness-repository.js'
import { StoryThreadRepository } from '../../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { VolumeRepository } from '../../../infra/repository/volume-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

export function loadDoctorVolumeView(database: NovelDatabase, volumeId: string): {
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  diagnostics: {
    chapterCount: number
    finalizedOutputCount: number
    hasVolumePlan: boolean
    threadCount: number
    endingTargetMatches: boolean
    stalledThreadCount: number
    closureGapCount: number
    neglectedThreadCount: number
    unfinishedChapterCount: number
  }
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
    hasOutput: boolean
  }>
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = new VolumeRepository(database).getById(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapterRepository = new ChapterRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapters = chapterRepository
    .listByBookId(book.id)
    .filter((chapter) => chapter.volumeId === volumeId)
    .map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
      hasOutput: Boolean(outputRepository.getLatestByChapterId(chapter.id)),
    }))

  const endingReadiness = new EndingReadinessRepository(database).getByBookId(book.id)
  const volumePlan = new VolumePlanRepository(database).getLatestByVolumeId(volumeId)
  const storyThreads = new StoryThreadRepository(database).listByVolumeId(volumeId)
  const neglectedThreadIds = (endingReadiness?.closureGaps ?? [])
    .map((gap) => gap.relatedThreadId)
    .filter((threadId): threadId is string => Boolean(threadId))
    .filter((threadId, index, values) => values.indexOf(threadId) === index)
  const stalledThreadCount = storyThreads.filter((thread) => thread.status === 'active' && thread.stage === 'setup').length
  const unfinishedChapterCount = chapters.filter((chapter) => chapter.status !== 'finalized').length

  return {
    volume,
    diagnostics: {
      chapterCount: chapters.length,
      finalizedOutputCount: chapters.filter((chapter) => chapter.hasOutput).length,
      hasVolumePlan: Boolean(volumePlan),
      threadCount: storyThreads.length,
      endingTargetMatches: endingReadiness?.targetVolumeId === volumeId,
      stalledThreadCount,
      closureGapCount: endingReadiness?.closureGaps.length ?? 0,
      neglectedThreadCount: neglectedThreadIds.length,
      unfinishedChapterCount,
    },
    chapters,
  }
}
