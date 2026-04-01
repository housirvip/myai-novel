import { Command } from 'commander'
import path from 'node:path'

import { BookService } from './core/book/service.js'
import { PlanningContextBuilder } from './core/context/planning-context-builder.js'
import { WritingContextBuilder } from './core/context/writing-context-builder.js'
import { GenerationService } from './core/generation/service.js'
import { PlanningService } from './core/planning/service.js'
import { ReviewService } from './core/review/service.js'
import { WorldService } from './core/world/service.js'
import { openDatabase } from './infra/db/database.js'
import { runMigrations } from './infra/db/migrate.js'
import { BookRepository } from './infra/repository/book-repository.js'
import { ChapterDraftRepository } from './infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from './infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from './infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from './infra/repository/chapter-review-repository.js'
import { OutlineRepository } from './infra/repository/outline-repository.js'
import { VolumeRepository } from './infra/repository/volume-repository.js'
import { NovelError, toErrorMessage } from './shared/utils/errors.js'
import {
  ensureProjectDirectories,
  readProjectConfig,
  resolveProjectPaths,
  writeProjectConfig,
} from './shared/utils/project-paths.js'

const program = new Command()

program
  .name('novel')
  .description('AI novel writing CLI')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize a new novel project in the current directory')
  .requiredOption('--title <title>', 'Book title')
  .requiredOption('--genre <genre>', 'Book genre')
  .option('--word-count <number>', 'Default chapter word count', parseInteger, 3000)
  .option('--tolerance <number>', 'Chapter word count tolerance ratio', parseFloatNumber, 0.15)
  .option('--model-provider <provider>', 'LLM provider name', 'openai')
  .option('--model-name <model>', 'LLM model name', 'gpt-5')
  .option('--temperature <number>', 'LLM temperature', parseFloatNumber)
  .option('--max-tokens <number>', 'LLM max tokens', parseInteger)
  .action(async (options) => {
    const paths = resolveProjectPaths(process.cwd())

    await ensureProjectDirectories(paths)
    await writeProjectConfig(paths, {
      database: {
        client: 'sqlite',
        filename: 'data/novel.sqlite',
      },
    })

    const database = openDatabase(paths.databaseFilePath)

    try {
      runMigrations(database)

      const bookService = new BookService(
        new BookRepository(database),
        new OutlineRepository(database),
      )

      const book = bookService.initializeBook({
        title: options.title,
        genre: options.genre,
        defaultChapterWordCount: options.wordCount,
        chapterWordCountToleranceRatio: options.tolerance,
        model: {
          provider: options.modelProvider,
          modelName: options.modelName,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        },
      })

      console.log(`Initialized novel project: ${book.title} (${book.id})`)
      console.log(`Database: ${paths.databaseFilePath}`)
    } finally {
      database.close()
    }
  })

const outlineCommand = program.command('outline').description('Manage outline data')

outlineCommand
  .command('set')
  .description('Set the book outline')
  .requiredOption('--premise <premise>', 'Story premise')
  .requiredOption('--theme <theme>', 'Story theme')
  .requiredOption('--worldview <worldview>', 'Worldview description')
  .requiredOption('--core-conflict <items...>', 'One or more core conflicts')
  .requiredOption('--ending-vision <endingVision>', 'Desired ending direction')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const bookService = new BookService(
        new BookRepository(database),
        new OutlineRepository(database),
      )

      const outline = bookService.setOutline({
        premise: options.premise,
        theme: options.theme,
        worldview: options.worldview,
        coreConflicts: options.coreConflict,
        endingVision: options.endingVision,
      })

      console.log(`Outline saved for book: ${outline.bookId}`)
    } finally {
      database.close()
    }
  })

const volumeCommand = program.command('volume').description('Manage volumes')

volumeCommand
  .command('add')
  .description('Add a volume')
  .requiredOption('--title <title>', 'Volume title')
  .requiredOption('--goal <goal>', 'Volume goal')
  .requiredOption('--summary <summary>', 'Volume summary')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
      )

      const volume = worldService.addVolume({
        title: options.title,
        goal: options.goal,
        summary: options.summary,
      })

      console.log(`Volume created: ${volume.title} (${volume.id})`)
    } finally {
      database.close()
    }
  })

const chapterCommand = program.command('chapter').description('Manage chapters')

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
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
      )

      const chapter = worldService.addChapter({
        volumeId: options.volumeId,
        title: options.title,
        objective: options.objective,
        plannedBeats: options.plannedBeat ?? [],
        index: options.index,
      })

      console.log(`Chapter created: #${chapter.index} ${chapter.title} (${chapter.id})`)
    } finally {
      database.close()
    }
  })

program
  .command('plan')
  .description('Planning commands')
  .command('chapter <chapterId>')
  .description('Generate a chapter plan')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const bookRepository = new BookRepository(database)
      const outlineRepository = new OutlineRepository(database)
      const chapterRepository = new ChapterRepository(database)
      const volumeRepository = new VolumeRepository(database)
      const contextBuilder = new PlanningContextBuilder(
        bookRepository,
        outlineRepository,
        chapterRepository,
        volumeRepository,
      )
      const planningService = new PlanningService(
        contextBuilder,
        new ChapterPlanRepository(database),
        chapterRepository,
      )

      const plan = planningService.planChapter(chapterId)

      console.log(`Chapter plan created: ${plan.versionId}`)
      console.log(`Objective: ${plan.objective}`)
      console.log(`Scenes: ${plan.sceneCards.length}`)
      console.log(`Events: ${plan.eventOutline.length}`)
    } finally {
      database.close()
    }
  })

program
  .command('write')
  .description('Writing commands')
  .command('next <chapterId>')
  .description('Generate the next chapter draft from the latest plan')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const bookRepository = new BookRepository(database)
      const outlineRepository = new OutlineRepository(database)
      const chapterRepository = new ChapterRepository(database)
      const volumeRepository = new VolumeRepository(database)
      const chapterPlanRepository = new ChapterPlanRepository(database)
      const planningContextBuilder = new PlanningContextBuilder(
        bookRepository,
        outlineRepository,
        chapterRepository,
        volumeRepository,
      )
      const writingContextBuilder = new WritingContextBuilder(
        planningContextBuilder,
        chapterPlanRepository,
      )
      const generationService = new GenerationService(
        writingContextBuilder,
        new ChapterDraftRepository(database),
        chapterRepository,
      )

      const result = generationService.writeNext(chapterId)

      console.log(`Chapter draft created: ${result.draftId}`)
      console.log(`Status: ${result.chapterStatus}`)
      console.log(`Word count: ${result.actualWordCount}`)
      console.log(`Next action: ${result.nextAction}`)
    } finally {
      database.close()
    }
  })

program
  .command('review')
  .description('Review commands')
  .command('chapter <chapterId>')
  .description('Review the latest draft for a chapter')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const reviewService = new ReviewService(
        new BookRepository(database),
        new ChapterRepository(database),
        new ChapterPlanRepository(database),
        new ChapterDraftRepository(database),
        new ChapterReviewRepository(database),
      )

      const review = reviewService.reviewChapter(chapterId)

      console.log(`Chapter review created: ${review.id}`)
      console.log(`Decision: ${review.decision}`)
      console.log(`Word count passed: ${review.wordCountCheck.passed}`)
      console.log(`Revision advice: ${review.revisionAdvice.join('；')}`)
    } finally {
      database.close()
    }
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = toErrorMessage(error)
  console.error(`Error: ${message}`)
  process.exitCode = error instanceof NovelError ? 1 : 1
})

async function openProjectDatabase() {
  const rootDir = process.cwd()
  const config = await readProjectConfig(rootDir)
  const databasePath = path.resolve(rootDir, config.database.filename)
  const database = openDatabase(databasePath)

  runMigrations(database)

  return database
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer: ${value}`)
  }

  return parsed
}

function parseFloatNumber(value: string): number {
  const parsed = Number.parseFloat(value)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return parsed
}
