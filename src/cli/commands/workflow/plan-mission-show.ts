import { Command } from 'commander'

import { NovelError } from '../../../shared/utils/errors.js'
import { openProjectDatabase } from '../../context.js'
import { printWorkflowMissionDetail } from '../workflow-printers.js'
import { loadWorkflowMissionViewAsync } from '../workflow-services.js'

export function registerWorkflowPlanMissionShowCommand(planCommand: Command): void {
  planCommand
    .command('mission-show <chapterId>')
    .description('Show the current chapter mission from the latest volume window plan')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // mission 不是章节自身字段，而是从最新卷窗口计划里反查出来的当前使命视图。
        const missionView = await loadWorkflowMissionViewAsync(database, chapterId)

        if (!missionView.mission) {
          throw new NovelError(`No mission found for chapter: ${chapterId}`)
        }

        printWorkflowMissionDetail(missionView)
      } finally {
        database.close()
      }
    })
}
