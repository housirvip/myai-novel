import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printWorkflowVolumeReviewDetail } from '../workflow-printers.js'
import { loadWorkflowVolumeReviewViewAsync } from '../workflow-services.js'

export function registerWorkflowReviewVolumeCommand(reviewCommand: Command): void {
  reviewCommand
    .command('volume <volumeId>')
    .description('Show a volume-level review summary across plan, threads, ending, and chapter reviews')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        printWorkflowVolumeReviewDetail(await loadWorkflowVolumeReviewViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
