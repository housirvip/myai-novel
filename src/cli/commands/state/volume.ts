import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateVolumeSummary } from './volume-printers.js'
import { loadStateVolumeViewAsync } from './volume-services.js'

export function registerStateVolumeCommand(stateCommand: Command): void {
  stateCommand
    .command('volume <volumeId>')
    .description('Show volume-level state, planning, and thread summary')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        printStateVolumeSummary(await loadStateVolumeViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
