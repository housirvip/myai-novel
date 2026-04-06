import { Command } from 'commander'

import { registerChapterAddCommand } from './add.js'
import { registerChapterApproveCommand } from './approve.js'
import { registerChapterDropCommand } from './drop.js'
import { registerChapterRewriteCommand } from './rewrite.js'
import { registerChapterShowCommand } from './show.js'

export function registerChapterCommands(program: Command): void {
  // `chapter` 放的是对章节主记录和当前链路节点做直接操作的命令，不和 workflow 的阶段命令混放。
  const chapterCommand = program.command('chapter').description('Manage chapters')

  registerChapterAddCommand(chapterCommand)
  registerChapterShowCommand(chapterCommand)
  registerChapterRewriteCommand(chapterCommand)
  registerChapterApproveCommand(chapterCommand)
  registerChapterDropCommand(chapterCommand)
}
