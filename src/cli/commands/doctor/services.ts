import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { resolveOperationLogDir } from '../../../shared/utils/project-paths.js'

/**
 * `doctor` 命令域的查询装配层。
 */
export function loadDoctorProjectView(database: NovelDatabase): {
  bookId: string
  chapterCount: number
  operationLogDir: string
  chapters: Array<{
    chapterId: string
    title: string
    status: string
    hasPlan: boolean
    hasDraft: boolean
    hasReview: boolean
    hasRewrite: boolean
    hasOutput: boolean
  }>
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapters = chapterRepository.listByBookId(book.id)

  return {
    bookId: book.id,
    chapterCount: chapters.length,
    operationLogDir: resolveOperationLogDir(process.cwd()),
    chapters: chapters.map((chapter) => ({
      chapterId: chapter.id,
      title: chapter.title,
      status: chapter.status,
      hasPlan: Boolean(planRepository.getLatestByChapterId(chapter.id)),
      hasDraft: Boolean(draftRepository.getLatestByChapterId(chapter.id)),
      hasReview: Boolean(reviewRepository.getLatestByChapterId(chapter.id)),
      hasRewrite: Boolean(rewriteRepository.getLatestByChapterId(chapter.id)),
      hasOutput: Boolean(outputRepository.getLatestByChapterId(chapter.id)),
    })),
  }
}

export function loadDoctorChapterView(database: NovelDatabase, chapterId: string): {
  chapter: {
    id: string
    index: number
    title: string
    status: string
    currentPlanVersionId?: string
    currentVersionId?: string
  }
  workflowChain: {
    chapterId: string
    status: string
    currentPlanVersionId: string | null
    currentVersionId: string | null
    latestPlanId: string | null
    latestDraftId: string | null
    latestReviewId: string | null
    latestRewriteId: string | null
    latestOutputId: string | null
    operationLogDir: string
  }
} {
  const chapterRepository = new ChapterRepository(database)
  const planRepository = new ChapterPlanRepository(database)
  const draftRepository = new ChapterDraftRepository(database)
  const reviewRepository = new ChapterReviewRepository(database)
  const rewriteRepository = new ChapterRewriteRepository(database)
  const outputRepository = new ChapterOutputRepository(database)
  const chapter = chapterRepository.getById(chapterId)

  if (!chapter) {
    throw new NovelError(`Chapter not found: ${chapterId}`)
  }

  return {
    chapter,
    workflowChain: {
      chapterId: chapter.id,
      status: chapter.status,
      currentPlanVersionId: chapter.currentPlanVersionId ?? null,
      currentVersionId: chapter.currentVersionId ?? null,
      latestPlanId: planRepository.getLatestByChapterId(chapterId)?.versionId ?? null,
      latestDraftId: draftRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestReviewId: reviewRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestRewriteId: rewriteRepository.getLatestByChapterId(chapterId)?.id ?? null,
      latestOutputId: outputRepository.getLatestByChapterId(chapterId)?.id ?? null,
      operationLogDir: resolveOperationLogDir(process.cwd()),
    },
  }
}
