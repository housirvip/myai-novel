import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printChapterSnapshot } from './printers.js'
import { loadSnapshotChapterView } from './services.js'

export function registerSnapshotChapterCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('chapter <chapterId>')
    .description('Print a workflow snapshot for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        printChapterSnapshot(loadSnapshotChapterView(database, chapterId))
      } finally {
        database.close()
      }
    })
}
