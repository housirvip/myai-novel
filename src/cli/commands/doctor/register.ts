import { Command } from 'commander'

import { registerDoctorChapterCommand } from './chapter.js'
import { registerDoctorProjectCommand } from './project.js'
import { registerDoctorVolumeCommand } from './volume.js'

export function registerDoctorCommands(program: Command): void {
  // doctor 入口按 project/chapter/volume 三层诊断粒度组织，避免所有检查堆进一个超大命令。
  const doctorCommand = program.command('doctor').description('Run diagnostic checks')

  registerDoctorProjectCommand(doctorCommand)
  registerDoctorChapterCommand(doctorCommand)
  registerDoctorVolumeCommand(doctorCommand)
}
