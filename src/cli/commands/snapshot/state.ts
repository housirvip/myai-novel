import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateSnapshot } from './printers.js'
import { loadSnapshotStateView } from './services.js'

export function registerSnapshotStateCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('state')
    .description('Print a state snapshot for the current project')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        printStateSnapshot(loadSnapshotStateView(database))
      } finally {
        database.close()
      }
    })
}
