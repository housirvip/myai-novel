import { Command } from 'commander'

import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { createWorkflowGenerationService, createWorkflowPlanningService, createWorkflowReviewService } from './workflow-services.js'
import {
  printWorkflowDraftCreated,
  printWorkflowPlanCreated,
  printWorkflowPlanDetail,
  printWorkflowReviewCreated,
  printWorkflowReviewDetail,
  printWorkflowRewriteDetail,
} from './workflow-printers.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../shared/utils/format.js'
import { openProjectDatabase, runLoggedCommand } from '../context.js'

export function registerWorkflowCommands(program: Command): void {
  const planCommand = program.command('plan').description('Planning commands')
  const writeCommand = program.command('write').description('Writing commands')
  const reviewCommand = program.command('review').description('Review commands')
  const draftCommand = program.command('draft').description('Draft commands')
  const rewriteCommand = program.command('rewrite').description('Rewrite result commands')

  planCommand
    .command('chapter <chapterId>')
    .description('Generate a chapter plan')
    .action(async (chapterId: string) => {
      const plan = await runLoggedCommand({
        command: 'plan chapter',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const planningService = createWorkflowPlanningService(database)
          const result = await planningService.planChapter(chapterId)

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter plan created: ${result.versionId}`,
            detail: {
              planVersionId: result.versionId,
              objective: result.objective,
              sceneCount: result.sceneCards.length,
              hookPlanCount: result.hookPlan.length,
              statePredictionCount: result.statePredictions.length,
            },
          }
        },
      })

      printWorkflowPlanCreated(plan)
    })

  planCommand
    .command('show <chapterId>')
    .description('Show the latest plan for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const plan = new ChapterPlanRepository(database).getLatestByChapterId(chapterId)

        if (!plan) {
          throw new NovelError(`No chapter plan found for chapter: ${chapterId}`)
        }

        printWorkflowPlanDetail(plan)
      } finally {
        database.close()
      }
    })

  writeCommand
    .command('next <chapterId>')
    .description('Generate the next chapter draft from the latest plan')
    .action(async (chapterId: string) => {
      const result = await runLoggedCommand({
        command: 'write next',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const generationService = createWorkflowGenerationService(database)
          const writeResult = await generationService.writeNext(chapterId)

          return {
            result: writeResult,
            chapterId,
            summary: `Chapter draft created: ${writeResult.draftId}`,
            detail: {
              draftId: writeResult.draftId,
              chapterStatus: writeResult.chapterStatus,
              wordCount: writeResult.actualWordCount,
              nextAction: writeResult.nextAction,
            },
          }
        },
      })

      printWorkflowDraftCreated(result)
    })

  draftCommand
    .command('show <chapterId>')
    .description('Show the latest draft for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const draft = new ChapterDraftRepository(database).getLatestByChapterId(chapterId)

        if (!draft) {
          throw new NovelError(`No chapter draft found for chapter: ${chapterId}`)
        }

        console.log(`Draft id: ${draft.id}`)
        console.log(`Version: ${draft.versionId}`)
        console.log(`Word count: ${draft.actualWordCount}`)
        console.log(formatSection('Content preview:', draft.content))
      } finally {
        database.close()
      }
    })

  reviewCommand
    .command('chapter <chapterId>')
    .description('Review the latest draft for a chapter')
    .action(async (chapterId: string) => {
      const review = await runLoggedCommand({
        command: 'review chapter',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const reviewService = createWorkflowReviewService(database)
          const result = await reviewService.reviewChapter(chapterId)

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter review created: ${result.id}`,
            detail: {
              reviewId: result.id,
              decision: result.decision,
              approvalRisk: result.approvalRisk,
              issueCount:
                result.consistencyIssues.length +
                result.characterIssues.length +
                result.itemIssues.length +
                result.memoryIssues.length +
                result.pacingIssues.length +
                result.hookIssues.length,
              closureCounts: {
                characters: result.closureSuggestions.characters.length,
                items: result.closureSuggestions.items.length,
                hooks: result.closureSuggestions.hooks.length,
                memory: result.closureSuggestions.memory.length,
              },
            },
          }
        },
      })

      printWorkflowReviewCreated(review)
    })

  reviewCommand
    .command('show <chapterId>')
    .description('Show the latest review for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const review = new ChapterReviewRepository(database).getLatestByChapterId(chapterId)

        if (!review) {
          throw new NovelError(`No chapter review found for chapter: ${chapterId}`)
        }

        printWorkflowReviewDetail(review)
      } finally {
        database.close()
      }
    })

  rewriteCommand
    .command('show <chapterId>')
    .description('Show the latest rewrite candidate for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const rewrite = new ChapterRewriteRepository(database).getLatestByChapterId(chapterId)

        if (!rewrite) {
          throw new NovelError(`No chapter rewrite found for chapter: ${chapterId}`)
        }

        printWorkflowRewriteDetail(rewrite)
      } finally {
        database.close()
      }
    })
}
