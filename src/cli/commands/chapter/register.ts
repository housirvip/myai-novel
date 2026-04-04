import { Command } from 'commander'

import { registerChapterAddCommand } from './add.js'
import { registerChapterApproveCommand } from './approve.js'
import { registerChapterDropCommand } from './drop.js'
import { registerChapterRewriteCommand } from './rewrite.js'
import { registerChapterShowCommand } from './show.js'

export function registerChapterCommands(program: Command): void {
  const chapterCommand = program.command('chapter').description('Manage chapters')

  registerChapterAddCommand(chapterCommand)
  registerChapterShowCommand(chapterCommand)
  registerChapterRewriteCommand(chapterCommand)
  registerChapterApproveCommand(chapterCommand)
  registerChapterDropCommand(chapterCommand)
}
