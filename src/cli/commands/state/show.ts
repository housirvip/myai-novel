import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateShowSummary } from './printers.js'
import { loadStateShowViewAsync } from './services.js'

export function registerStateShowCommand(stateCommand: Command): void {
  stateCommand
    .command('show')
    .description('Show current canonical state for the current book')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        printStateShowSummary(await loadStateShowViewAsync(database))
      } finally {
        database.close()
      }
    })
}
