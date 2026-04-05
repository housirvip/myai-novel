import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorVolumeSummary } from './volume-printers.js'
import { loadDoctorVolumeViewAsync } from './volume-services.js'

export function registerDoctorVolumeCommand(doctorCommand: Command): void {
  doctorCommand
    .command('volume <volumeId>')
    .description('Run diagnostics for a single volume')
    .option('--json', 'Print raw JSON diagnostics')
    .option('--strict', 'Exit with code 1 when high risks exist')
    .action(async (volumeId: string, options: { json?: boolean; strict?: boolean }) => {
      const database = await openProjectDatabase()

      try {
        const view = await loadDoctorVolumeViewAsync(database, volumeId)

        if (options.json) {
          console.log(JSON.stringify(view, null, 2))
        } else {
          printDoctorVolumeSummary(view)
        }

        if (options.strict && view.diagnostics.highRiskCount > 0) {
          process.exitCode = 1
        }
      } finally {
        database.close()
      }
    })
}
