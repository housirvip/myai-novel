import { Command } from 'commander'

import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { printWorkflowReviewDetail } from '../workflow-printers.js'
import { openProjectDatabase } from '../../context.js'

export function registerWorkflowReviewShowCommand(reviewCommand: Command): void {
  reviewCommand
    .command('show <chapterId>')
    .description('Show the latest review for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        // review detail 直接展示最新审阅结果，供人工分析问题项和 rewrite 建议。
        const review = await new ChapterReviewRepository(database).getLatestByChapterIdAsync(chapterId)

        if (!review) {
          throw new NovelError(`No chapter review found for chapter: ${chapterId}`)
        }

        printWorkflowReviewDetail(review)
      } finally {
        database.close()
      }
    })
}
