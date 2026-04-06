import { Command } from 'commander'

import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { printWorkflowRewriteDetail } from '../workflow-printers.js'
import { openProjectDatabase } from '../../context.js'

export function registerWorkflowRewriteShowCommand(rewriteCommand: Command): void {
  rewriteCommand
    .command('show <chapterId>')
    .description('Show the latest rewrite candidate for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // rewrite show 查看的是最近一次改写候选，不等同于最终 approved output。
        const rewrite = await new ChapterRewriteRepository(database).getLatestByChapterIdAsync(chapterId)

        if (!rewrite) {
          throw new NovelError(`No chapter rewrite found for chapter: ${chapterId}`)
        }

        printWorkflowRewriteDetail(rewrite)
      } finally {
        database.close()
      }
    })
}
