import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printVolumeSnapshot } from './volume-printers.js'
import { loadSnapshotVolumeViewAsync } from './volume-services.js'

export function registerSnapshotVolumeCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('volume <volumeId>')
    .description('Print a volume-level workflow snapshot')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        // 卷 snapshot 适合一次性核对 volume plan、threads、ending readiness 与章节列表是否一致。
        printVolumeSnapshot(await loadSnapshotVolumeViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
