import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorVolumeSummary } from './volume-printers.js'
import { loadDoctorVolumeViewAsync } from './volume-services.js'

export function registerDoctorVolumeCommand(doctorCommand: Command): void {
  doctorCommand
    .command('volume <volumeId>')
    .description('Run diagnostics for a single volume')
    .option('--json', 'Print raw JSON diagnostics')
    .option('--strict', 'Exit with code 1 when high risks exist')
    .action(async (volumeId: string, options: { json?: boolean; strict?: boolean }) => {
      const database = await openProjectDatabase()

      try {
        const view = await loadDoctorVolumeViewAsync(database, volumeId)

        if (options.json) {
          // `--json` 给自动化脚本或 CI 消费，避免经过终端友好格式化后再解析。
          console.log(JSON.stringify(view, null, 2))
        } else {
          printDoctorVolumeSummary(view)
        }

        if (options.strict && view.diagnostics.highRiskCount > 0) {
          // `--strict` 只改退出码，不改输出内容，便于本地和 CI 共享同一份诊断视图。
          process.exitCode = 1
        }
      } finally {
        database.close()
      }
    })
}
