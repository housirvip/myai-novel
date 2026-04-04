import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorProjectSummary } from './printers.js'
import { loadDoctorProjectView } from './services.js'

export function registerDoctorProjectCommand(doctorCommand: Command): void {
  doctorCommand
    .description('Run project-level diagnostics')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        printDoctorProjectSummary(loadDoctorProjectView(database))
      } finally {
        database.close()
      }
    })
}
