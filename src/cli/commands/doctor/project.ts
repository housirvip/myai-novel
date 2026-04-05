import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorProjectSummary } from './printers.js'
import { loadDoctorBootstrapView, loadDoctorProjectView } from './services.js'

export function registerDoctorProjectCommand(doctorCommand: Command): void {
  doctorCommand
    .description('Run project-level diagnostics')
    .action(async () => {
      try {
        const database = await openProjectDatabase()

        try {
          printDoctorProjectSummary(loadDoctorProjectView(database))
        } finally {
          database.close()
        }
      } catch (error) {
        if (isMissingProjectConfigError(error)) {
          printDoctorProjectSummary(loadDoctorBootstrapView())
          return
        }

        throw error
      }
    })
}

function isMissingProjectConfigError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes('config/database.json')
}
