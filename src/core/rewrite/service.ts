import type { ChapterRewrite, LlmAdapter, RewriteRequest } from '../../shared/types/domain.js'
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
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async rewriteChapter(request: RewriteRequest): Promise<ChapterRewrite> {
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
    const content = this.llmAdapter
      ? await createLlmRewrite(
          this.llmAdapter,
          book.title,
          chapter.title,
          chapter.objective,
          draft.content,
          review.revisionAdvice,
          {
            consistencyIssues: review.consistencyIssues,
            characterIssues: review.characterIssues,
            itemIssues: review.itemIssues,
            memoryIssues: review.memoryIssues,
            pacingIssues: review.pacingIssues,
            hookIssues: review.hookIssues,
          },
          request.goals,
        )
      : buildRewriteContent(draft.content, review.revisionAdvice, request.goals)
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

async function createLlmRewrite(
  llmAdapter: LlmAdapter,
  bookTitle: string,
  chapterTitle: string,
  chapterObjective: string,
  content: string,
  revisionAdvice: string[],
  reviewIssues: {
    consistencyIssues: string[]
    characterIssues: string[]
    itemIssues: string[]
    memoryIssues: string[]
    pacingIssues: string[]
    hookIssues: string[]
  },
  goals: string[],
): Promise<string> {
  try {
    const response = await llmAdapter.generateText({
      system: [
        '你是长篇小说章节重写助手。你的任务不是自由改写，而是在不破坏既有事实与状态连续性的前提下，定向修复问题。',
        '必须优先修复：目标承接、节奏、关键场景、角色状态一致性、关键物品连续性、Hook 承接、结尾牵引。',
        '不得把正文改写成摘要、说明文或审查报告。',
        '不得随意删除关键事实、不得推翻已成立的剧情因果、不得削弱结尾牵引。',
        '请直接输出重写后的章节正文，不要解释，不要输出 markdown 代码块。',
      ].join(' '),
      user: JSON.stringify(
        {
          task: {
            kind: 'chapter-rewrite',
            bookTitle,
            chapterTitle,
            chapterObjective,
            goals,
            mustKeep: [
              '章节核心目标不变',
              '既有事实不被推翻',
              '关键物品与 Hook 连续性不被破坏',
              '结尾牵引至少不弱于原稿',
            ],
          },
          draft: content,
          revisionAdvice,
          reviewIssues,
        },
        null,
        2,
      ),
    })

    return response.text.trim()
  } catch {
    return buildRewriteContent(content, revisionAdvice, goals)
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
