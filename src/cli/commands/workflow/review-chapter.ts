import { Command } from 'commander'

import { createWorkflowReviewService } from '../workflow-services.js'
import { printWorkflowReviewCreated } from '../workflow-printers.js'
import { runLoggedCommand, summarizeLlmMetadata } from '../../context.js'

export function registerWorkflowReviewChapterCommand(reviewCommand: Command): void {
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
            // review 命令日志更关心决策与问题规模，便于回看这次审阅为什么给出当前结论。
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
              llm: summarizeLlmMetadata(result.llmMetadata),
            },
          }
        },
      })

      printWorkflowReviewCreated(review)
    })
}
