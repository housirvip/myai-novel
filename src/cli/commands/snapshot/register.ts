import { Command } from 'commander'

import { registerSnapshotChapterCommand } from './chapter.js'
import { registerSnapshotStateCommand } from './state.js'
import { registerSnapshotVolumeCommand } from './volume.js'

export function registerSnapshotCommands(program: Command): void {
  const snapshotCommand = program.command('snapshot').description('Snapshot helper commands')

  registerSnapshotStateCommand(snapshotCommand)
  registerSnapshotChapterCommand(snapshotCommand)
  registerSnapshotVolumeCommand(snapshotCommand)
}
