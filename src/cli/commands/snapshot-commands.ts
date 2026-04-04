import { Command } from 'commander'

import { registerSnapshotChapterCommand } from './snapshot/chapter.js'
import { registerSnapshotStateCommand } from './snapshot/state.js'

export function registerSnapshotCommands(program: Command): void {
  const snapshotCommand = program.command('snapshot').description('Snapshot helper commands')

  registerSnapshotStateCommand(snapshotCommand)
  registerSnapshotChapterCommand(snapshotCommand)
}
