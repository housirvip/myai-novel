import { Command } from 'commander'

import { registerSnapshotChapterCommand } from './chapter.js'
import { registerSnapshotStateCommand } from './state.js'
import { registerSnapshotVolumeCommand } from './volume.js'

export function registerSnapshotCommands(program: Command): void {
  // `snapshot` 聚焦只读检查，因此子命令只按 state/chapter/volume 三个观察视角拆分。
  const snapshotCommand = program.command('snapshot').description('Snapshot helper commands')

  registerSnapshotStateCommand(snapshotCommand)
  registerSnapshotChapterCommand(snapshotCommand)
  registerSnapshotVolumeCommand(snapshotCommand)
}
