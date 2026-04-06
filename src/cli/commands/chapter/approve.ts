import { Command } from 'commander'

import { createChapterApproveService } from '../chapter-services.js'
import { printChapterApproved } from '../chapter-printers.js'
import { runLoggedCommand } from '../../context.js'

export function registerChapterApproveCommand(chapterCommand: Command): void {
  chapterCommand
    .command('approve <chapterId>')
    .description('Approve the latest reviewed chapter and export the final output')
    .option('--force', 'Approve even when the latest review risk is high')
    .action(async (chapterId: string, options) => {
      const force = Boolean(options.force)
      const result = await runLoggedCommand({
        command: 'chapter approve',
        args: buildApproveArgs(chapterId, force),
        chapterId,
        detail: { force },
        action: async (database) => {
          const approveService = createChapterApproveService(database, process.cwd())

          const approveResult = await approveService.approveChapter(chapterId, { force })

          return {
            result: approveResult,
            chapterId,
            // approve 日志会记录所有落库副作用，便于追查最终通过时更新了哪些状态域。
            summary: `Chapter approved: ${approveResult.chapterId}`,
            detail: {
              chapterStatus: approveResult.chapterStatus,
              versionId: approveResult.versionId,
              finalPath: approveResult.finalPath,
              approvedAt: approveResult.approvedAt,
              forcedApproval: approveResult.forcedApproval,
              stateUpdated: approveResult.stateUpdated,
              memoryUpdated: approveResult.memoryUpdated,
              hooksUpdated: approveResult.hooksUpdated,
              threadProgressUpdated: approveResult.threadProgressUpdated,
              endingReadinessUpdated: approveResult.endingReadinessUpdated,
            },
          }
        },
      })

      printChapterApproved(result)
    })
}

function buildApproveArgs(chapterId: string, force: boolean): string[] {
  // 把实际执行参数单独收口，保证日志里记录的 args 与用户命令语义一致。
  return force ? [chapterId, '--force'] : [chapterId]
}
