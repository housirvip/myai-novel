import { Command } from 'commander'

import { runLoggedCommand } from '../../context.js'
import { printStateUpdatesSummary } from '../state/printers.js'
import { loadStateUpdatesViewAsync } from '../state/services.js'

export function registerStateUpdatesShowCommand(stateUpdatesCommand: Command): void {
  stateUpdatesCommand
    .command('show <chapterId>')
    .description('Show state, memory, and hook updates for a chapter')
    .action(async (chapterId: string) => {
      const output = await runLoggedCommand({
        command: 'state-updates show',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const result = await loadStateUpdatesViewAsync(database, chapterId)

          return {
            result,
            chapterId,
            bookId: result.chapter?.bookId,
            // 日志里记录 update 数量和 reviewId，足够帮助回溯“这一章到底落了多少状态变更”。
            summary: `State updates loaded for chapter: ${chapterId}`,
            detail: {
              stateUpdateCount: result.stateUpdates.length,
              memoryUpdateCount: result.memoryUpdates.length,
              hookUpdateCount: result.hookUpdates.length,
              reviewId: result.review?.id,
            },
          }
        },
      })

      printStateUpdatesSummary(output)
    })
}
