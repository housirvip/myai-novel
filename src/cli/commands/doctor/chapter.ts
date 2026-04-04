import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorChapterSummary } from './printers.js'
import { loadDoctorChapterView } from './services.js'

export function registerDoctorChapterCommand(doctorCommand: Command): void {
  doctorCommand
    .command('chapter <chapterId>')
    .description('Run diagnostics for a single chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        printDoctorChapterSummary(loadDoctorChapterView(database, chapterId))
      } finally {
        database.close()
      }
    })
}
