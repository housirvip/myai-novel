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
        printStateThreadsSummary(await loadStateThreadsViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
