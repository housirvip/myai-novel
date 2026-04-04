import { Command } from 'commander'

import { BookRepository } from '../../../infra/repository/book-repository.js'
import { StoryStateRepository } from '../../../infra/repository/story-state-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { openProjectDatabase } from '../../context.js'
import { printStoryState } from '../state/printers.js'

export function registerStoryShowCommand(program: Command): void {
  program
    .command('story')
    .description('Story state commands')
    .command('show')
    .description('Show current story state')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        const book = new BookRepository(database).getFirst()

        if (!book) {
          throw new NovelError('Project is not initialized. Run `novel init` first.')
        }

        const state = new StoryStateRepository(database).getByBookId(book.id)
        printStoryState(state)
      } finally {
        database.close()
      }
    })
}
