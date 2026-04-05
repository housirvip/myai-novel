import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printRegressionRun } from './printers.js'
import { executeRegressionCase } from './services.js'

export function registerRegressionRunCommand(regressionCommand: Command): void {
  regressionCommand
    .command('run <caseName> [targetId]')
    .description('Execute a regression case with an optional chapter or volume target')
    .action(async (caseName: string, targetId?: string) => {
      const database = await openProjectDatabase()

      try {
        printRegressionRun(executeRegressionCase(database, caseName, targetId))
      } finally {
        database.close()
      }
    })
}
