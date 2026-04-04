import { Command } from 'commander'

import { BUILTIN_CASES } from './cases.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function registerRegressionRunCommand(regressionCommand: Command): void {
  regressionCommand
    .command('run <caseName>')
    .description('Show the selected regression case to run manually')
    .action((caseName: string) => {
      console.log(formatSection('Regression run:', formatJson({
        caseName,
        known: BUILTIN_CASES.includes(caseName),
        status: 'skeleton-only',
        note: 'This command currently reserves the case name and standard output format.',
      })))
    })
}
