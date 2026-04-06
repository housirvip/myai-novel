import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateEndingSummary } from './printers.js'
import { loadStateEndingViewAsync } from './services.js'

export function registerStateEndingCommand(stateCommand: Command): void {
  stateCommand
    .command('ending')
    .description('Show current ending-readiness and closure status for the book')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        // ending 视图专门把终局准备度单独拎出来，避免埋在 state show 的大快照里难以观察。
        printStateEndingSummary(await loadStateEndingViewAsync(database))
      } finally {
        database.close()
      }
    })
}
