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
        printVolumeSnapshot(await loadSnapshotVolumeViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
