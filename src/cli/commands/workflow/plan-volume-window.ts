import { Command } from 'commander'

import { createWorkflowPlanningContextBuilder, createWorkflowPlanningService, createWorkflowVolumePlanRepository } from '../workflow-services.js'
import { printWorkflowVolumePlanCreated } from '../workflow-printers.js'
import { runLoggedCommand } from '../../context.js'

export function registerWorkflowPlanVolumeWindowCommand(planCommand: Command): void {
  planCommand
    .command('volume-window <chapterId>')
    .description('Generate and persist a rolling volume-window plan anchored on a chapter')
    .action(async (chapterId: string) => {
      const plan = await runLoggedCommand({
        command: 'plan volume-window',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const contextBuilder = createWorkflowPlanningContextBuilder(database)
          const planningService = createWorkflowPlanningService(database)
          const volumePlanRepository = createWorkflowVolumePlanRepository(database)
          const context = contextBuilder.build(chapterId)
          const result = planningService.planVolumeWindow(context)

          volumePlanRepository.create(result)

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Volume window plan created: ${result.id}`,
            detail: {
              volumePlanId: result.id,
              volumeId: result.volumeId,
              title: result.title,
              threadCount: result.threadIds.length,
              missionCount: result.chapterMissions.length,
            },
          }
        },
      })

      printWorkflowVolumePlanCreated(plan)
    })
}
