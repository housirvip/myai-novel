import { Command } from 'commander'

import { BookRepository } from '../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../shared/utils/format.js'
import { openProjectDatabase } from '../context.js'

export function registerSnapshotCommands(program: Command): void {
  const snapshotCommand = program.command('snapshot').description('Snapshot helper commands')

  snapshotCommand
    .command('state')
    .description('Print a state snapshot for the current project')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        const book = new BookRepository(database).getFirst()

        if (!book) {
          throw new NovelError('Project is not initialized. Run `novel init` first.')
        }

        const storyStateRepository = new StoryStateRepository(database)
        const chapterRepository = new ChapterRepository(database)
        const chapters = chapterRepository.listByBookId(book.id)

        console.log(
          formatSection(
            'State snapshot:',
            formatJson({
              storyState: storyStateRepository.getByBookId(book.id) ?? null,
              chapters: chapters.map((chapter) => ({
                chapterId: chapter.id,
                title: chapter.title,
                status: chapter.status,
                currentPlanVersionId: chapter.currentPlanVersionId ?? null,
                currentVersionId: chapter.currentVersionId ?? null,
              })),
            }),
          ),
        )
      } finally {
        database.close()
      }
    })

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
