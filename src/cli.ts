import { Command } from 'commander'

import { registerChapterCommands } from './cli/commands/chapter-commands.js'
import { registerProjectCommands } from './cli/commands/project-commands.js'
import { registerStateCommands } from './cli/commands/state-commands.js'
import { registerWorkflowCommands } from './cli/commands/workflow-commands.js'
import { registerWorldCommands } from './cli/commands/world-commands.js'
import { NovelError, toErrorMessage } from './shared/utils/errors.js'

const program = new Command()

program
  .name('novel')
  .description('AI novel writing CLI')
  .version('0.1.0')

registerProjectCommands(program)
registerWorldCommands(program)
registerChapterCommands(program)
registerWorkflowCommands(program)
registerStateCommands(program)

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = toErrorMessage(error)
  console.error(`Error: ${message}`)
  process.exitCode = error instanceof NovelError ? 1 : 1
})
