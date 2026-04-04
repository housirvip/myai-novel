import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorVolumeSummary } from './volume-printers.js'
import { loadDoctorVolumeView } from './volume-services.js'

export function registerDoctorVolumeCommand(doctorCommand: Command): void {
  doctorCommand
    .command('volume <volumeId>')
    .description('Run diagnostics for a single volume')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        printDoctorVolumeSummary(loadDoctorVolumeView(database, volumeId))
      } finally {
        database.close()
      }
    })
}
