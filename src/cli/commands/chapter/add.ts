import { Command } from 'commander'

import { createChapterWorldService } from '../chapter-services.js'
import { printChapterCreated } from '../chapter-printers.js'
import { openProjectDatabase, parseInteger } from '../../context.js'

export function registerChapterAddCommand(chapterCommand: Command): void {
  chapterCommand
    .command('add')
    .description('Add a chapter')
    .requiredOption('--volume-id <volumeId>', 'Target volume id')
    .requiredOption('--title <title>', 'Chapter title')
    .requiredOption('--objective <objective>', 'Chapter objective')
    .option('--planned-beat <items...>', 'Planned beats for the chapter')
    .option('--index <number>', 'Override chapter index', parseInteger)
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const chapter = createChapterWorldService(database).addChapter({
          volumeId: options.volumeId,
          title: options.title,
          objective: options.objective,
          plannedBeats: options.plannedBeat ?? [],
          index: options.index,
        })

        printChapterCreated(chapter)
      } finally {
        database.close()
      }
    })
}
