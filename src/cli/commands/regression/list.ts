import { Command } from 'commander'

import { BUILTIN_CASES } from './cases.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function registerRegressionListCommand(regressionCommand: Command): void {
  regressionCommand
    .command('list')
    .description('List built-in regression cases')
    .action(() => {
      console.log(formatSection('Regression cases:', formatJson(BUILTIN_CASES)))
    })
}
