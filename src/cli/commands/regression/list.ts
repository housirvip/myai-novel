import { Command } from 'commander'

import { BUILTIN_CASES } from './cases.js'
import { printRegressionCases } from './printers.js'

export function registerRegressionListCommand(regressionCommand: Command): void {
  regressionCommand
    .command('list')
    .description('List built-in regression cases')
    .action(() => {
      printRegressionCases(BUILTIN_CASES)
    })
}
