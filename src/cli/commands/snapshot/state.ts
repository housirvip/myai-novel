import { Command } from 'commander'

import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { StoryStateRepository } from '../../../infra/repository/story-state-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { openProjectDatabase } from '../../context.js'
import { printStateSnapshot } from './printers.js'

export function registerSnapshotStateCommand(snapshotCommand: Command): void {
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

        printStateSnapshot({
          storyState: storyStateRepository.getByBookId(book.id) ?? null,
          chapters: chapters.map((chapter) => ({
            chapterId: chapter.id,
            title: chapter.title,
            status: chapter.status,
            currentPlanVersionId: chapter.currentPlanVersionId ?? null,
            currentVersionId: chapter.currentVersionId ?? null,
          })),
        })
      } finally {
        database.close()
      }
    })
}
