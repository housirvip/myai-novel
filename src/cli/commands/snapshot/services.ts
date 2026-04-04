import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { StoryStateRepository } from '../../../infra/repository/story-state-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

/**
 * `snapshot` 命令域的查询装配层。
 */
export function loadSnapshotStateView(database: NovelDatabase): {
  storyState: unknown
  chapters: Array<{
    chapterId: string
    title: string
    status: string
    currentPlanVersionId: string | null
    currentVersionId: string | null
  }>
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const chapters = chapterRepository.listByBookId(book.id)

  return {
    storyState: new StoryStateRepository(database).getByBookId(book.id) ?? null,
    chapters: chapters.map((chapter) => ({
      chapterId: chapter.id,
      title: chapter.title,
      status: chapter.status,
      currentPlanVersionId: chapter.currentPlanVersionId ?? null,
      currentVersionId: chapter.currentVersionId ?? null,
    })),
  }
}

export function loadSnapshotChapterView(database: NovelDatabase, chapterId: string): {
  chapter: unknown
  latestPlan: unknown
  latestDraft: unknown
  latestReview: unknown
  latestRewrite: unknown
  latestOutput: unknown
} {
  const chapterRepository = new ChapterRepository(database)
  const chapter = chapterRepository.getById(chapterId)

  if (!chapter) {
    throw new NovelError(`Chapter not found: ${chapterId}`)
  }

  return {
    chapter,
    latestPlan: new ChapterPlanRepository(database).getLatestByChapterId(chapterId),
    latestDraft: new ChapterDraftRepository(database).getLatestByChapterId(chapterId),
    latestReview: new ChapterReviewRepository(database).getLatestByChapterId(chapterId),
    latestRewrite: new ChapterRewriteRepository(database).getLatestByChapterId(chapterId),
    latestOutput: new ChapterOutputRepository(database).getLatestByChapterId(chapterId),
  }
}
