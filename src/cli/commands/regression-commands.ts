import { Command } from 'commander'

import { registerRegressionListCommand } from './regression/list.js'
import { registerRegressionRunCommand } from './regression/run.js'

export function registerRegressionCommands(program: Command): void {
  const regressionCommand = program.command('regression').description('Regression helper commands')

  registerRegressionListCommand(regressionCommand)
  registerRegressionRunCommand(regressionCommand)
}
