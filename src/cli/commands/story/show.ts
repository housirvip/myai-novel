import { Command } from 'commander'

import { BookRepository } from '../../../infra/repository/book-repository.js'
import { StoryStateRepository } from '../../../infra/repository/story-state-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { formatJson } from '../../../shared/utils/format.js'
import { openProjectDatabase } from '../../context.js'

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

        if (!state) {
          console.log('Story state: (empty)')
          return
        }

        console.log(formatJson(state))
      } finally {
        database.close()
      }
    })
}
