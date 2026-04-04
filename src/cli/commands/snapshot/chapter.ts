import { Command } from 'commander'

import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'
import { openProjectDatabase } from '../../context.js'

export function registerSnapshotChapterCommand(snapshotCommand: Command): void {
  snapshotCommand
    .command('chapter <chapterId>')
    .description('Print a workflow snapshot for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const chapterRepository = new ChapterRepository(database)
        const chapter = chapterRepository.getById(chapterId)

        if (!chapter) {
          throw new NovelError(`Chapter not found: ${chapterId}`)
        }

        console.log(
          formatSection(
            'Chapter snapshot:',
            formatJson({
              chapter,
              latestPlan: new ChapterPlanRepository(database).getLatestByChapterId(chapterId),
              latestDraft: new ChapterDraftRepository(database).getLatestByChapterId(chapterId),
              latestReview: new ChapterReviewRepository(database).getLatestByChapterId(chapterId),
              latestRewrite: new ChapterRewriteRepository(database).getLatestByChapterId(chapterId),
              latestOutput: new ChapterOutputRepository(database).getLatestByChapterId(chapterId),
            }),
          ),
        )
      } finally {
        database.close()
      }
    })
}
