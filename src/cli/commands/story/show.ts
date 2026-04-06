import { Command } from 'commander'

import { openProjectDatabase } from '../../context.js'
import { printStoryState } from '../state/printers.js'
import { loadStoryStateViewAsync } from '../state/services.js'

export function registerStoryShowCommand(program: Command): void {
  program
    .command('story')
    .description('Story state commands')
    .command('show')
    .description('Show current story state')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        // `story show` 保留旧入口，只输出最核心的 story_state 视图，适合快速看全局故事游标。
        printStoryState((await loadStoryStateViewAsync(database)).state)
      } finally {
        database.close()
      }
    })
}
