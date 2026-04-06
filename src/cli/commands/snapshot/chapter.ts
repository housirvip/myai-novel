import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printChapterSnapshot } from './printers.js'
import { loadSnapshotChapterViewAsync } from './services.js'

export function registerSnapshotChapterCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('chapter <chapterId>')
    .description('Print a workflow snapshot for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // 章节 snapshot 直接聚合 latest plan/draft/review/rewrite/output，方便排查链路断点。
        printChapterSnapshot(await loadSnapshotChapterViewAsync(database, chapterId))
      } finally {
        database.close()
      }
    })
}
