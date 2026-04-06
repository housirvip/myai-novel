import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateThreadsSummary } from './printers.js'
import { loadStateThreadsViewAsync } from './services.js'

export function registerStateThreadsCommand(stateCommand: Command): void {
  stateCommand
    .command('threads [volumeId]')
    .description('Show active story threads and recent progress, optionally scoped to a volume')
    .action(async (volumeId?: string) => {
      const database = await openProjectDatabase()

      try {
        // volumeId 可选，使这条命令既能看整书主线，也能聚焦某一卷窗口内的线程推进。
        printStateThreadsSummary(await loadStateThreadsViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
