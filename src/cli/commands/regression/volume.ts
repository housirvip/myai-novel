import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printRegressionVolumeSuite } from './printers.js'
import { executeVolumeRegressionSuite } from './services.js'

export function registerRegressionVolumeCommand(regressionCommand: Command): void {
  regressionCommand
    .command('volume <volumeId>')
    .description('Execute the built-in volume-level regression suite')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        printRegressionVolumeSuite(await executeVolumeRegressionSuite(database, volumeId))
      } finally {
        database.close()
      }
    })
}
