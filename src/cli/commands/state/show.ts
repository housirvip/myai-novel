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
        // `state show` 是整书级 canonical projection 入口，优先看“现在是什么状态”而不是单章过程。
        printStateShowSummary(await loadStateShowViewAsync(database))
      } finally {
        database.close()
      }
    })
}
