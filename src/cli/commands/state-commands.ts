import { Command } from 'commander'

import { registerStateShowCommand } from './state/show.js'
import { registerStateUpdatesShowCommand } from './state-updates/show.js'
import { registerStoryShowCommand } from './story/show.js'

export function registerStateCommands(program: Command): void {
  registerStoryShowCommand(program)

  const stateCommand = program.command('state').description('State tracing commands')
  registerStateShowCommand(stateCommand)

  const stateUpdatesCommand = program.command('state-updates').description('State update trace commands')
  registerStateUpdatesShowCommand(stateUpdatesCommand)
}
