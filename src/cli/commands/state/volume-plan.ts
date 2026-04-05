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
        printStateVolumePlanSummary(await loadStateVolumePlanViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
