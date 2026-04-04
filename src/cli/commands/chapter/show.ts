import { Command } from 'commander'

import { ChapterContradictionRepository } from '../../../infra/repository/chapter-contradiction-repository.js'
import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterHookUpdateRepository } from '../../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../../infra/repository/chapter-memory-update-repository.js'
import { ChapterOutcomeRepository } from '../../../infra/repository/chapter-outcome-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { ChapterStateUpdateRepository } from '../../../infra/repository/chapter-state-update-repository.js'
import { NarrativeDebtRepository } from '../../../infra/repository/narrative-debt-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { printChapterShowSummary } from '../chapter-printers.js'
import { openProjectDatabase } from '../../context.js'

export function registerChapterShowCommand(chapterCommand: Command): void {
  chapterCommand
    .command('show <chapterId>')
    .description('Show the current chapter state and latest process outputs')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const chapterRepository = new ChapterRepository(database)
        const planRepository = new ChapterPlanRepository(database)
        const draftRepository = new ChapterDraftRepository(database)
        const reviewRepository = new ChapterReviewRepository(database)
        const rewriteRepository = new ChapterRewriteRepository(database)
        const outputRepository = new ChapterOutputRepository(database)
        const outcomeRepository = new ChapterOutcomeRepository(database)
        const narrativeDebtRepository = new NarrativeDebtRepository(database)
        const contradictionRepository = new ChapterContradictionRepository(database)
        const stateUpdateRepository = new ChapterStateUpdateRepository(database)
        const memoryUpdateRepository = new ChapterMemoryUpdateRepository(database)
        const hookUpdateRepository = new ChapterHookUpdateRepository(database)
        const chapter = chapterRepository.getById(chapterId)

        if (!chapter) {
          throw new NovelError(`Chapter not found: ${chapterId}`)
        }

        const latestPlan = planRepository.getLatestByChapterId(chapterId)
        const latestDraft = draftRepository.getLatestByChapterId(chapterId)
        const latestReview = reviewRepository.getLatestByChapterId(chapterId)
        const latestRewrite = rewriteRepository.getLatestByChapterId(chapterId)
        const latestOutput = outputRepository.getLatestByChapterId(chapterId)
        const latestOutcome = outcomeRepository.getLatestByChapterId(chapterId)
        const chapterDebts = narrativeDebtRepository.listByChapterId(chapterId)
        const chapterContradictions = contradictionRepository.listByChapterId(chapterId)
        const latestStateUpdates = stateUpdateRepository.listByChapterId(chapterId)
        const latestMemoryUpdates = memoryUpdateRepository.listByChapterId(chapterId)
        const latestHookUpdates = hookUpdateRepository.listByChapterId(chapterId)

        printChapterShowSummary({
          chapter,
          latestPlan,
          latestDraft,
          latestReview,
          latestRewrite,
          latestOutput,
          latestOutcome,
          chapterDebts,
          chapterContradictions,
          latestStateUpdates,
          latestMemoryUpdates,
          latestHookUpdates,
        })
      } finally {
        database.close()
      }
    })
}
