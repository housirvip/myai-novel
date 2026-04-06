import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateSnapshot } from './printers.js'
import { loadSnapshotStateViewAsync } from './services.js'

export function registerSnapshotStateCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('state')
    .description('Print a state snapshot for the current project')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        // snapshot 子命令刻意绕开命令日志装饰，输出尽量贴近数据库当前快照本身。
        printStateSnapshot(await loadSnapshotStateViewAsync(database))
      } finally {
        database.close()
      }
    })
}
