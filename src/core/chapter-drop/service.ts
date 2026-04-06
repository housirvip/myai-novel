import type {
  ChapterStatus,
  DropChapterRequest,
  DropChapterResult,
} from '../../shared/types/domain.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../shared/utils/errors.js'

export class ChapterDropService {
  constructor(
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterPlanRepository: ChapterPlanRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterReviewRepository: ChapterReviewRepository,
    private readonly chapterRewriteRepository: ChapterRewriteRepository,
    private readonly chapterOutputRepository: ChapterOutputRepository,
  ) {}

  dropChapter(request: DropChapterRequest): DropChapterResult {
    const chapter = this.chapterRepository.getById(request.chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${request.chapterId}`)
    }

    if (chapter.status === 'finalized' && !request.force) {
      throw new NovelError('Finalized chapter cannot be dropped without --force.')
    }

    const latestOutput = this.chapterOutputRepository.getLatestByChapterId(request.chapterId)

    if (latestOutput && latestOutput.finalPath && !request.force) {
      throw new NovelError('Chapter already has finalized output. Use --force to drop current references only.')
    }

    const latestDraft = this.chapterDraftRepository.getLatestByChapterId(request.chapterId)
    const latestReview = this.chapterReviewRepository.getLatestByChapterId(request.chapterId)
    const latestRewrite = this.chapterRewriteRepository.getLatestByChapterId(request.chapterId)
    // plan drop 只影响 chapter.currentPlanVersionId，本身不删除历史 plan 记录。
    const droppedPlan = chapter.currentPlanVersionId
      ? this.chapterPlanRepository.getByVersionId(request.chapterId, chapter.currentPlanVersionId)
      : null

    const shouldDropPlan = request.dropMode === 'plan-only' || request.dropMode === 'all-current'
    const shouldDropDraftChain = request.dropMode === 'draft-only' || request.dropMode === 'all-current'

    if (shouldDropPlan && !chapter.currentPlanVersionId) {
      throw new NovelError('Chapter has no current plan to drop.')
    }

    if (shouldDropDraftChain && !chapter.currentVersionId && !latestDraft && !latestRewrite && !latestReview) {
      throw new NovelError('Chapter has no current draft chain to drop.')
    }

    // drop 的语义是“断开当前引用”，而不是物理删除 draft/review/rewrite/output 历史产物。
    const nextCurrentPlanVersionId = shouldDropPlan ? null : (chapter.currentPlanVersionId ?? null)
    const nextCurrentVersionId = shouldDropDraftChain ? null : (chapter.currentVersionId ?? null)
    const nextStatus = deriveNextStatus(chapter.status, nextCurrentPlanVersionId, nextCurrentVersionId)

    this.chapterRepository.updateWorkflowState(
      request.chapterId,
      {
        status: nextStatus,
        currentPlanVersionId: nextCurrentPlanVersionId,
        currentVersionId: nextCurrentVersionId,
        draftPath: shouldDropDraftChain ? null : (chapter.draftPath ?? null),
        finalPath: chapter.finalPath ?? null,
        approvedAt: chapter.approvedAt ?? null,
        summary: chapter.summary ?? null,
      },
      request.requestedAt,
    )

    return {
      chapterId: request.chapterId,
      dropMode: request.dropMode,
      droppedPlanVersionId: shouldDropPlan ? droppedPlan?.versionId ?? chapter.currentPlanVersionId : undefined,
      droppedDraftVersionId: shouldDropDraftChain ? resolveDroppedDraftVersionId(chapter.currentVersionId, latestDraft, latestRewrite) : undefined,
      droppedReviewId: shouldDropDraftChain ? latestReview?.id : undefined,
      droppedRewriteId: shouldDropDraftChain ? latestRewrite?.id : undefined,
      previousChapterStatus: chapter.status,
      nextChapterStatus: nextStatus,
      timestamp: request.requestedAt,
    }
  }
}

function deriveNextStatus(
  previousStatus: ChapterStatus,
  currentPlanVersionId: string | null,
  currentVersionId: string | null,
): ChapterStatus {
  // finalized 章节即使 force drop 当前引用，也保留 finalized 状态，避免伪装成未完结章节。
  if (previousStatus === 'finalized') {
    return 'finalized'
  }

  if (currentVersionId) {
    return previousStatus === 'reviewed' ? 'reviewed' : 'drafted'
  }

  if (currentPlanVersionId) {
    return 'planned'
  }

  return 'planned'
}

function resolveDroppedDraftVersionId(
  currentVersionId: string | undefined,
  latestDraft: { versionId: string } | null,
  latestRewrite: { versionId: string } | null,
): string | undefined {
  // 优先返回当前挂载的 version；若当前为空，则退回最新 rewrite/draft，便于日志说明断开的链路端点。
  if (!currentVersionId) {
    return latestRewrite?.versionId ?? latestDraft?.versionId
  }

  if (latestRewrite?.versionId === currentVersionId) {
    return latestRewrite.versionId
  }

  if (latestDraft?.versionId === currentVersionId) {
    return latestDraft.versionId
  }

  return currentVersionId
}
