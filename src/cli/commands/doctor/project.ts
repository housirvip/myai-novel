import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printDoctorProjectSummary } from './printers.js'
import { loadDoctorBootstrapView, loadDoctorProjectViewAsync } from './services.js'

export function registerDoctorProjectCommand(doctorCommand: Command): void {
  doctorCommand
    .description('Run project-level diagnostics')
    .action(async () => {
      try {
        const database = await openProjectDatabase()

        try {
          printDoctorProjectSummary(await loadDoctorProjectViewAsync(database))
        } finally {
          database.close()
        }
      } catch (error) {
        // 项目尚未初始化时仍然允许 `doctor` 输出 bootstrap 诊断，先帮助用户发现 env / config 问题。
        if (isMissingProjectConfigError(error)) {
          printDoctorProjectSummary(loadDoctorBootstrapView())
          return
        }

        throw error
      }
    })
}

function isMissingProjectConfigError(error: unknown): boolean {
  // 这里不依赖具体错误类型，而是按当前配置缺失的可预期报错信息做兼容判断。
  return error instanceof Error
    && error.message.includes('config/database.json')
}
