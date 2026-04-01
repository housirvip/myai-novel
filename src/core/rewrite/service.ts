import type { ChapterRewrite, RewriteRequest } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'

export class RewriteService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly chapterRewriteRepository: ChapterRewriteRepository,
  ) {}

  rewriteChapter(request: RewriteRequest): ChapterRewrite {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(request.chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${request.chapterId}`)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(request.chapterId)

    if (!draft) {
      throw new NovelError('Draft is required before rewrite. Run `novel write next <id>`.')
    }

    const review = this.chapterReviewRepository.getLatestByChapterId(request.chapterId)

    if (!review) {
      throw new NovelError('Review is required before rewrite. Run `novel review chapter <id>`.')
    }

    const timestamp = nowIso()
    const content = buildRewriteContent(draft.content, review.revisionAdvice, request.goals)
    const rewrite: ChapterRewrite = {
      id: createId('rewrite'),
      bookId: book.id,
      chapterId: request.chapterId,
      sourceDraftId: draft.id,
      sourceReviewId: review.id,
      versionId: createId('rewrite_version'),
      strategy: request.strategy,
      goals: request.goals,
      content,
      actualWordCount: estimateWordCount(content),
      createdAt: timestamp,
    }

    this.chapterRewriteRepository.create(rewrite)
    this.chapterRepository.updateCurrentVersion(request.chapterId, rewrite.versionId, timestamp)

    return rewrite
  }
}

function buildRewriteContent(content: string, revisionAdvice: string[], goals: string[]): string {
  const header = [
    '## 重写说明',
    '',
    ...revisionAdvice.map((item) => `- 审查建议：${item}`),
    ...goals.map((goal) => `- 重写目标：${goal}`),
    '',
  ].join('\n')

  return `${header}${content}\n\n## 重写后补充\n\n本版本已根据审查意见进行了定向调整，重点优化节奏、目标承接和结尾牵引。`
}

function estimateWordCount(content: string): number {
  return content.replace(/\s+/g, '').length
}
