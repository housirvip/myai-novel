import { Command } from 'commander'

import { registerStateEndingCommand } from './ending.js'
import { registerStateShowCommand } from './show.js'
import { registerStateThreadsCommand } from './threads.js'
import { registerStateVolumePlanCommand } from './volume-plan.js'
import { registerStateVolumeCommand } from './volume.js'
import { registerStateUpdatesShowCommand } from '../state-updates/show.js'
import { registerStoryShowCommand } from '../story/show.js'

export function registerStateCommands(program: Command): void {
  // `story show` 仍挂在根级，兼容旧用法；其余 v6 状态相关命令统一收口到 `state` 域下。
  registerStoryShowCommand(program)

  const stateCommand = program.command('state').description('State tracing commands')
  registerStateShowCommand(stateCommand)
  registerStateThreadsCommand(stateCommand)
  registerStateEndingCommand(stateCommand)
  registerStateVolumePlanCommand(stateCommand)
  registerStateVolumeCommand(stateCommand)

  // `state-updates` 单独分组，是因为它更偏章节级变更痕迹而不是当前状态快照。
  const stateUpdatesCommand = program.command('state-updates').description('State update trace commands')
  registerStateUpdatesShowCommand(stateUpdatesCommand)
}
