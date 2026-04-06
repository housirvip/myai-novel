import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateVolumePlanSummary } from './printers.js'
import { loadStateVolumePlanViewAsync } from './services.js'

export function registerStateVolumePlanCommand(stateCommand: Command): void {
  stateCommand
    .command('volume-plan <volumeId>')
    .description('Show the latest volume plan and mission window for a volume')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        // 这里关注的是状态层如何消费最新卷计划，而不是 workflow 侧的完整计划详情。
        printStateVolumePlanSummary(await loadStateVolumePlanViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
