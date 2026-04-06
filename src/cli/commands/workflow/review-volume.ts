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
        // 卷级 review 目前是只读聚合视图，不走 runLoggedCommand，避免把大型汇总结果重复写入操作日志。
        printWorkflowVolumeReviewDetail(await loadWorkflowVolumeReviewViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
