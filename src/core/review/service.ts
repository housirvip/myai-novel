import type { LlmAdapter, ReviewDecision, ReviewReport, WordCountCheck } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { extractJsonObject } from '../../shared/utils/json.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { NovelError } from '../../shared/utils/errors.js'

export class ReviewService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async reviewChapter(chapterId: string): Promise<ReviewReport> {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (!draft) {
      throw new NovelError('Draft is required before review. Run `novel write next <id>`.')
    }

    const plan = chapter.currentPlanVersionId
      ? this.chapterPlanRepository.getByVersionId(chapterId, chapter.currentPlanVersionId)
      : this.chapterPlanRepository.getLatestByChapterId(chapterId)

    if (!plan) {
      throw new NovelError('Chapter plan is missing for review.')
    }

    const wordCountCheck = createWordCountCheck(
      book.defaultChapterWordCount,
      draft.actualWordCount,
      book.chapterWordCountToleranceRatio,
    )

    const baseReview = createRuleBasedReview(wordCountCheck, chapter.objective, draft.content, plan.sceneCards.length, plan.hookPlan.length)
    const aiReview = this.llmAdapter
      ? await createLlmReview(this.llmAdapter, wordCountCheck, chapter.objective, draft.content, plan.eventOutline)
      : null
    const mergedReview = aiReview ?? baseReview
    const review: ReviewReport = {
      id: createId('review'),
      bookId: book.id,
      chapterId,
      draftId: draft.id,
      decision: mergedReview.decision,
      consistencyIssues: mergedReview.consistencyIssues,
      characterIssues: mergedReview.characterIssues,
      pacingIssues: mergedReview.pacingIssues,
      hookIssues: mergedReview.hookIssues,
      wordCountCheck,
      revisionAdvice: mergedReview.revisionAdvice,
      createdAt: nowIso(),
    }

    this.chapterReviewRepository.create(review)
    this.chapterRepository.markReviewed(chapterId, review.createdAt)

    return review
  }
}

function createRuleBasedReview(
  wordCountCheck: WordCountCheck,
  objective: string,
  content: string,
  sceneCardCount: number,
  hookPlanCount: number,
): Omit<ReviewReport, 'id' | 'bookId' | 'chapterId' | 'draftId' | 'wordCountCheck' | 'createdAt'> {
  const consistencyIssues = content.includes(objective) ? [] : ['草稿未明显呼应章节目标。']
  const pacingIssues = sceneCardCount < 2 ? ['场景拆分过少，节奏可能过于平。'] : []
  const hookIssues = hookPlanCount === 0 ? ['当前计划未显式记录钩子推进。'] : []
  const characterIssues: string[] = []

  return {
    decision: decideReview(wordCountCheck, consistencyIssues, hookIssues),
    consistencyIssues,
    characterIssues,
    pacingIssues,
    hookIssues,
    revisionAdvice: buildRevisionAdvice(wordCountCheck, consistencyIssues, hookIssues),
  }
}

async function createLlmReview(
  llmAdapter: LlmAdapter,
  wordCountCheck: WordCountCheck,
  objective: string,
  content: string,
  eventOutline: string[],
): Promise<Omit<ReviewReport, 'id' | 'bookId' | 'chapterId' | 'draftId' | 'wordCountCheck' | 'createdAt'> | null> {
  try {
    const response = await llmAdapter.generateText({
      system:
        '你是小说审查助手。请只输出 JSON，不要解释。JSON 字段必须包含 decision, consistencyIssues, characterIssues, pacingIssues, hookIssues, revisionAdvice。',
      user: JSON.stringify(
        {
          objective,
          eventOutline,
          wordCountCheck,
          draft: content,
        },
        null,
        2,
      ),
    })

    const parsed = JSON.parse(extractJsonObject(response.text)) as Partial<ReviewReport>

    return {
      decision: parsed.decision ?? 'warning',
      consistencyIssues: parsed.consistencyIssues ?? [],
      characterIssues: parsed.characterIssues ?? [],
      pacingIssues: parsed.pacingIssues ?? [],
      hookIssues: parsed.hookIssues ?? [],
      revisionAdvice: parsed.revisionAdvice ?? ['建议人工复核本章审查结果。'],
    }
  } catch {
    return null
  }
}

function createWordCountCheck(target: number, actual: number, toleranceRatio: number): WordCountCheck {
  const deviationRatio = target === 0 ? 0 : Math.abs(actual - target) / target

  return {
    target,
    actual,
    toleranceRatio,
    deviationRatio,
    passed: deviationRatio <= toleranceRatio,
  }
}

function buildRevisionAdvice(
  wordCountCheck: WordCountCheck,
  consistencyIssues: string[],
  hookIssues: string[],
): string[] {
  const advice: string[] = []

  if (!wordCountCheck.passed) {
    advice.push('优先调整篇幅，使内容更接近目标字数区间。')
  }

  if (consistencyIssues.length > 0) {
    advice.push('补强章节目标与正文事件之间的对应关系。')
  }

  if (hookIssues.length > 0) {
    advice.push('在结尾补入下一章牵引点或明确钩子推进。')
  }

  if (advice.length === 0) {
    advice.push('当前草稿可进入确认或轻量润色阶段。')
  }

  return advice
}

function decideReview(
  wordCountCheck: WordCountCheck,
  consistencyIssues: string[],
  hookIssues: string[],
): ReviewDecision {
  if (!wordCountCheck.passed || consistencyIssues.length > 0) {
    return 'needs-rewrite'
  }

  if (hookIssues.length > 0) {
    return 'warning'
  }

  return 'pass'
}
