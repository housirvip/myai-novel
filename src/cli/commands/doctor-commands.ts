import { Command } from 'commander'

import { registerDoctorChapterCommand } from './doctor/chapter.js'
import { registerDoctorProjectCommand } from './doctor/project.js'

export function registerDoctorCommands(program: Command): void {
  const doctorCommand = program.command('doctor').description('Run diagnostic checks')

  registerDoctorProjectCommand(doctorCommand)
  registerDoctorChapterCommand(doctorCommand)
}
