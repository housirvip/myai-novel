import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { EndingReadinessRepository } from '../../../infra/repository/ending-readiness-repository.js'
import { StoryThreadRepository } from '../../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { VolumeRepository } from '../../../infra/repository/volume-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

export function loadSnapshotVolumeView(database: NovelDatabase, volumeId: string): {
  volume: unknown
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
  chapters: Array<{
    chapter: unknown
    latestPlan: unknown
    latestDraft: unknown
    latestReview: unknown
    latestRewrite: unknown
    latestOutput: unknown
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
  const chapters = chapterRepository
    .listByBookId(book.id)
    .filter((chapter) => chapter.volumeId === volumeId)
    .map((chapter) => ({
      chapter,
      latestPlan: new ChapterPlanRepository(database).getLatestByChapterId(chapter.id),
      latestDraft: new ChapterDraftRepository(database).getLatestByChapterId(chapter.id),
      latestReview: new ChapterReviewRepository(database).getLatestByChapterId(chapter.id),
      latestRewrite: new ChapterRewriteRepository(database).getLatestByChapterId(chapter.id),
      latestOutput: new ChapterOutputRepository(database).getLatestByChapterId(chapter.id),
    }))

  return {
    volume,
    latestVolumePlan: new VolumePlanRepository(database).getLatestByVolumeId(volumeId),
    storyThreads: new StoryThreadRepository(database).listByVolumeId(volumeId),
    endingReadiness: new EndingReadinessRepository(database).getByBookId(book.id),
    chapters,
  }
}

export async function loadSnapshotVolumeViewAsync(database: NovelDatabase, volumeId: string): Promise<{
  volume: unknown
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
  chapters: Array<{
    chapter: unknown
    latestPlan: unknown
    latestDraft: unknown
    latestReview: unknown
    latestRewrite: unknown
    latestOutput: unknown
  }>
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = await new VolumeRepository(database).getByIdAsync(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapterRepository = new ChapterRepository(database)
  const chapterRows = await chapterRepository.listByBookIdAsync(book.id)
  const chapters = await Promise.all(
    chapterRows
      .filter((chapter) => chapter.volumeId === volumeId)
      .map(async (chapter) => ({
        chapter,
        latestPlan: await new ChapterPlanRepository(database).getLatestByChapterIdAsync(chapter.id),
        latestDraft: await new ChapterDraftRepository(database).getLatestByChapterIdAsync(chapter.id),
        latestReview: await new ChapterReviewRepository(database).getLatestByChapterIdAsync(chapter.id),
        latestRewrite: await new ChapterRewriteRepository(database).getLatestByChapterIdAsync(chapter.id),
        latestOutput: await new ChapterOutputRepository(database).getLatestByChapterIdAsync(chapter.id),
      })),
  )

  return {
    volume,
    latestVolumePlan: await new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId),
    storyThreads: await new StoryThreadRepository(database).listByVolumeIdAsync(volumeId),
    endingReadiness: await new EndingReadinessRepository(database).getByBookIdAsync(book.id),
    chapters,
  }
}
