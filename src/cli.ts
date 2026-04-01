import { Command } from 'commander'
import path from 'node:path'

import { BookService } from './core/book/service.js'
import { PlanningContextBuilder } from './core/context/planning-context-builder.js'
import { WritingContextBuilder } from './core/context/writing-context-builder.js'
import { GenerationService } from './core/generation/service.js'
import { PlanningService } from './core/planning/service.js'
import { ApproveService } from './core/approve/service.js'
import { ReviewService } from './core/review/service.js'
import { RewriteService } from './core/rewrite/service.js'
import { WorldService } from './core/world/service.js'
import { openDatabase } from './infra/db/database.js'
import { runMigrations } from './infra/db/migrate.js'
import { createLlmAdapter } from './infra/llm/factory.js'
import { BookRepository } from './infra/repository/book-repository.js'
import { ChapterDraftRepository } from './infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from './infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from './infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from './infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from './infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from './infra/repository/chapter-rewrite-repository.js'
import { OutlineRepository } from './infra/repository/outline-repository.js'
import { StoryStateRepository } from './infra/repository/story-state-repository.js'
import { VolumeRepository } from './infra/repository/volume-repository.js'
import { NovelError, toErrorMessage } from './shared/utils/errors.js'
import { formatJson, formatList } from './shared/utils/format.js'
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
const bookCommand = program.command('book').description('Manage book data')

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

bookCommand
  .command('show')
  .description('Show the current book and outline')
  .action(async () => {
    const database = await openProjectDatabase()

    try {
      const bookRepository = new BookRepository(database)
      const outlineRepository = new OutlineRepository(database)
      const volumeRepository = new VolumeRepository(database)
      const chapterRepository = new ChapterRepository(database)
      const book = bookRepository.getFirst()

      if (!book) {
        throw new NovelError('Project is not initialized. Run `novel init` first.')
      }

      const outline = outlineRepository.getByBookId(book.id)
      const volumes = volumeRepository.listByBookId(book.id)
      const chapters = chapterRepository.listByBookId(book.id)

      console.log(`Book: ${book.title}`)
      console.log(`ID: ${book.id}`)
      console.log(`Genre: ${book.genre}`)
      console.log(`Default chapter words: ${book.defaultChapterWordCount}`)
      console.log(`Tolerance ratio: ${book.chapterWordCountToleranceRatio}`)
      console.log(`Model: ${book.model.provider}/${book.model.modelName}`)
      console.log(`Volumes: ${volumes.length}`)
      console.log(`Chapters: ${chapters.length}`)

      if (outline) {
        console.log(`Premise: ${outline.premise}`)
        console.log(formatList('Core conflicts', outline.coreConflicts))
      }
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

chapterCommand
  .command('show <chapterId>')
  .description('Show the current chapter state and latest process outputs')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const chapterRepository = new ChapterRepository(database)
      const planRepository = new ChapterPlanRepository(database)
      const draftRepository = new ChapterDraftRepository(database)
      const reviewRepository = new ChapterReviewRepository(database)
      const rewriteRepository = new ChapterRewriteRepository(database)
      const outputRepository = new ChapterOutputRepository(database)
      const chapter = chapterRepository.getById(chapterId)

      if (!chapter) {
        throw new NovelError(`Chapter not found: ${chapterId}`)
      }

      const latestPlan = planRepository.getLatestByChapterId(chapterId)
      const latestDraft = draftRepository.getLatestByChapterId(chapterId)
      const latestReview = reviewRepository.getLatestByChapterId(chapterId)
      const latestRewrite = rewriteRepository.getLatestByChapterId(chapterId)
      const latestOutput = outputRepository.getLatestByChapterId(chapterId)

      console.log(`Chapter: #${chapter.index} ${chapter.title}`)
      console.log(`ID: ${chapter.id}`)
      console.log(`Status: ${chapter.status}`)
      console.log(`Objective: ${chapter.objective}`)
      console.log(`Planned beats: ${chapter.plannedBeats.length}`)
      console.log(`Current plan version: ${chapter.currentPlanVersionId ?? '(none)'}`)
      console.log(`Current version: ${chapter.currentVersionId ?? '(none)'}`)
      console.log(`Approved at: ${chapter.approvedAt ?? '(not approved)'}`)

      if (latestPlan) {
        console.log(`Latest plan: ${latestPlan.versionId}`)
      }

      if (latestDraft) {
        console.log(`Latest draft: ${latestDraft.id} (${latestDraft.actualWordCount} chars)`)
      }

      if (latestReview) {
        console.log(`Latest review: ${latestReview.id} [${latestReview.decision}]`)
      }

      if (latestRewrite) {
        console.log(`Latest rewrite: ${latestRewrite.id} (${latestRewrite.actualWordCount} chars)`)
      }

      if (latestOutput) {
        console.log(`Final output: ${latestOutput.finalPath}`)
      }
    } finally {
      database.close()
    }
  })

chapterCommand
  .command('rewrite <chapterId>')
  .description('Rewrite the latest draft for a chapter')
  .option('--goal <items...>', 'One or more rewrite goals')
  .option('--strategy <strategy>', 'Rewrite strategy: full or partial', 'partial')
  .action(async (chapterId: string, options) => {
    const database = await openProjectDatabase()

    try {
      const rewriteService = new RewriteService(
        new BookRepository(database),
        new ChapterRepository(database),
        new ChapterDraftRepository(database),
        new ChapterReviewRepository(database),
        new ChapterRewriteRepository(database),
        createLlmAdapter(new BookRepository(database).getFirst()),
      )

      const rewrite = await rewriteService.rewriteChapter({
        chapterId,
        strategy: options.strategy === 'full' ? 'full' : 'partial',
        goals: options.goal ?? ['优化节奏与结尾牵引'],
        preserveFacts: true,
        preserveHooks: true,
        preserveEndingBeat: true,
      })

      console.log(`Chapter rewrite created: ${rewrite.id}`)
      console.log(`Version: ${rewrite.versionId}`)
      console.log(`Word count: ${rewrite.actualWordCount}`)
      console.log(`Goals: ${rewrite.goals.join('；')}`)
    } finally {
      database.close()
    }
  })

chapterCommand
  .command('approve <chapterId>')
  .description('Approve the latest reviewed chapter and export the final output')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const approveService = new ApproveService(
        process.cwd(),
        new BookRepository(database),
        new ChapterRepository(database),
        new ChapterDraftRepository(database),
        new ChapterRewriteRepository(database),
        new ChapterOutputRepository(database),
        new StoryStateRepository(database),
      )

      const result = await approveService.approveChapter(chapterId)

      console.log(`Chapter approved: ${result.chapterId}`)
      console.log(`Status: ${result.chapterStatus}`)
      console.log(`Final path: ${result.finalPath}`)
      console.log(`Approved at: ${result.approvedAt}`)
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
        createLlmAdapter(bookRepository.getFirst()),
      )

      const plan = await planningService.planChapter(chapterId)

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
        createLlmAdapter(bookRepository.getFirst()),
      )

      const result = await generationService.writeNext(chapterId)

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
        createLlmAdapter(new BookRepository(database).getFirst()),
      )

      const review = await reviewService.reviewChapter(chapterId)

      console.log(`Chapter review created: ${review.id}`)
      console.log(`Decision: ${review.decision}`)
      console.log(`Word count passed: ${review.wordCountCheck.passed}`)
      console.log(`Revision advice: ${review.revisionAdvice.join('；')}`)
    } finally {
      database.close()
    }
  })

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
