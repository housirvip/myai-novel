import { Command } from 'commander'

import { NovelError } from '../../../shared/utils/errors.js'
import { openProjectDatabase } from '../../context.js'
import { printWorkflowMissionDetail } from '../workflow-printers.js'
import { loadWorkflowMissionView } from '../workflow-services.js'

export function registerWorkflowPlanMissionShowCommand(planCommand: Command): void {
  planCommand
    .command('mission-show <chapterId>')
    .description('Show the current chapter mission from the latest volume window plan')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const missionView = loadWorkflowMissionView(database, chapterId)

        if (!missionView.mission) {
          throw new NovelError(`No mission found for chapter: ${chapterId}`)
        }

        printWorkflowMissionDetail(missionView)
      } finally {
        database.close()
      }
    })
}
