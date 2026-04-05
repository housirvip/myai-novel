import { Command } from 'commander'

import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { openProjectDatabase } from '../../context.js'
import { printWorkflowVolumePlanDetail } from '../workflow-printers.js'

export function registerWorkflowPlanVolumeShowCommand(planCommand: Command): void {
  planCommand
    .command('volume-show <volumeId>')
    .description('Show the latest rolling volume-window plan for a volume')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        const plan = await new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId)

        if (!plan) {
          throw new NovelError(`No volume window plan found for volume: ${volumeId}`)
        }

        printWorkflowVolumePlanDetail(plan)
      } finally {
        database.close()
      }
    })
}
