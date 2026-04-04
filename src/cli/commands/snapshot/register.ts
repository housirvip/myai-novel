import { Command } from 'commander'

import { registerSnapshotChapterCommand } from './chapter.js'
import { registerSnapshotStateCommand } from './state.js'

export function registerSnapshotCommands(program: Command): void {
  const snapshotCommand = program.command('snapshot').description('Snapshot helper commands')

  registerSnapshotStateCommand(snapshotCommand)
  registerSnapshotChapterCommand(snapshotCommand)
}
