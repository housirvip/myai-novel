import { Command } from 'commander'

import { printRegressionVolumeRun } from './volume-printers.js'

const BUILTIN_VOLUME_CASES = ['volume-plan-smoke', 'thread-carry-smoke', 'ending-readiness-smoke']

export function registerRegressionVolumeCommand(regressionCommand: Command): void {
  regressionCommand
    .command('volume <volumeId>')
    .description('Show reserved regression cases for a volume-level manual run')
    .action((volumeId: string) => {
      printRegressionVolumeRun({
        volumeId,
        cases: BUILTIN_VOLUME_CASES,
        status: 'skeleton-only',
        note: 'This command reserves the volume-level regression output contract for future executors.',
      })
    })
}
