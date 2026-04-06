import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorChapterSummary } from './printers.js'
import { loadDoctorChapterViewAsync } from './services.js'

export function registerDoctorChapterCommand(doctorCommand: Command): void {
  doctorCommand
    .command('chapter <chapterId>')
    .description('Run diagnostics for a single chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // chapter doctor 只读不修复，职责是把当前指针与最新产物是否一致展示出来。
        printDoctorChapterSummary(await loadDoctorChapterViewAsync(database, chapterId))
      } finally {
        database.close()
      }
    })
}
