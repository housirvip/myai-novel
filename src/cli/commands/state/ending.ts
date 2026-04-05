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
        printStateEndingSummary(await loadStateEndingViewAsync(database))
      } finally {
        database.close()
      }
    })
}
