import { Command } from 'commander'

import { registerRegressionListCommand } from './list.js'
import { registerRegressionRunCommand } from './run.js'
import { registerRegressionVolumeCommand } from './volume.js'

export function registerRegressionCommands(program: Command): void {
  const regressionCommand = program.command('regression').description('Regression helper commands')

  registerRegressionListCommand(regressionCommand)
  registerRegressionRunCommand(regressionCommand)
  registerRegressionVolumeCommand(regressionCommand)
}
