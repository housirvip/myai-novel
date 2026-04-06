import { Command } from 'commander'

import { createWorkflowPlanningService } from '../workflow-services.js'
import { printWorkflowPlanCreated } from '../workflow-printers.js'
import { runLoggedCommand, summarizeLlmMetadata } from '../../context.js'

export function registerWorkflowPlanChapterCommand(planCommand: Command): void {
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
            // 计划命令日志偏向“这次生成覆盖了多少结构”，便于快速判断是否产出了完整计划。
            summary: `Chapter plan created: ${result.versionId}`,
            detail: {
              planVersionId: result.versionId,
              objective: result.objective,
              sceneCount: result.sceneCards.length,
              hookPlanCount: result.hookPlan.length,
              statePredictionCount: result.statePredictions.length,
              llm: summarizeLlmMetadata(result.llmMetadata),
            },
          }
        },
      })

      printWorkflowPlanCreated(plan)
    })
}
