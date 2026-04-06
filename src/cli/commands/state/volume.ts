import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStateVolumeSummary } from './volume-printers.js'
import { loadStateVolumeViewAsync } from './volume-services.js'

export function registerStateVolumeCommand(stateCommand: Command): void {
  stateCommand
    .command('volume <volumeId>')
    .description('Show volume-level state, planning, and thread summary')
    .action(async (volumeId: string) => {
      const database = await openProjectDatabase()

      try {
        // `state volume` 把卷内章节、卷计划、线程和 ending readiness 放在同一视角下对照查看。
        printStateVolumeSummary(await loadStateVolumeViewAsync(database, volumeId))
      } finally {
        database.close()
      }
    })
}
