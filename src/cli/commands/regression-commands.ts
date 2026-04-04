import { Command } from 'commander'

import { formatJson, formatSection } from '../../shared/utils/format.js'

const BUILTIN_CASES = ['hook-pressure-smoke', 'chapter-drop-safety', 'review-layering-smoke']

export function registerRegressionCommands(program: Command): void {
  const regressionCommand = program.command('regression').description('Regression helper commands')

  regressionCommand
    .command('list')
    .description('List built-in regression cases')
    .action(() => {
      console.log(formatSection('Regression cases:', formatJson(BUILTIN_CASES)))
    })

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
