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
        const plan = new ChapterPlanRepository(database).getLatestByChapterId(chapterId)

        if (!plan) {
          throw new NovelError(`No chapter plan found for chapter: ${chapterId}`)
        }

        printWorkflowPlanDetail(plan)
      } finally {
        database.close()
      }
    })
}
