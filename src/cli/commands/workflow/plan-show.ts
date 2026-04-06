import { Command } from 'commander'

import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { printWorkflowPlanDetail } from '../workflow-printers.js'
import { openProjectDatabase } from '../../context.js'

export function registerWorkflowPlanShowCommand(planCommand: Command): void {
  planCommand
    .command('show <chapterId>')
    .description('Show the latest plan for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // show 命令读取“最新计划”，而不是 chapter.currentPlanVersionId，对应的是最近一次生成结果的细节查看。
        const plan = await new ChapterPlanRepository(database).getLatestByChapterIdAsync(chapterId)

        if (!plan) {
          throw new NovelError(`No chapter plan found for chapter: ${chapterId}`)
        }

        printWorkflowPlanDetail(plan)
      } finally {
        database.close()
      }
    })
}
