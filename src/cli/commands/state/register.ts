import { Command } from 'commander'

import { registerStateEndingCommand } from './ending.js'
import { registerStateShowCommand } from './show.js'
import { registerStateThreadsCommand } from './threads.js'
import { registerStateVolumePlanCommand } from './volume-plan.js'
import { registerStateVolumeCommand } from './volume.js'
import { registerStateUpdatesShowCommand } from '../state-updates/show.js'
import { registerStoryShowCommand } from '../story/show.js'

export function registerStateCommands(program: Command): void {
  registerStoryShowCommand(program)

  const stateCommand = program.command('state').description('State tracing commands')
  registerStateShowCommand(stateCommand)
  registerStateThreadsCommand(stateCommand)
  registerStateEndingCommand(stateCommand)
  registerStateVolumePlanCommand(stateCommand)
  registerStateVolumeCommand(stateCommand)

  const stateUpdatesCommand = program.command('state-updates').description('State update trace commands')
  registerStateUpdatesShowCommand(stateUpdatesCommand)
}
