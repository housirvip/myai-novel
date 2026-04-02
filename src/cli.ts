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
import { CharacterCurrentStateRepository } from './infra/repository/character-current-state-repository.js'
import { CharacterRepository } from './infra/repository/character-repository.js'
import { ChapterDraftRepository } from './infra/repository/chapter-draft-repository.js'
import { ChapterHookUpdateRepository } from './infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from './infra/repository/chapter-memory-update-repository.js'
import { ChapterOutputRepository } from './infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from './infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from './infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from './infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from './infra/repository/chapter-rewrite-repository.js'
import { ChapterStateUpdateRepository } from './infra/repository/chapter-state-update-repository.js'
import { FactionRepository } from './infra/repository/faction-repository.js'
import { HookRepository } from './infra/repository/hook-repository.js'
import { HookStateRepository } from './infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from './infra/repository/item-current-state-repository.js'
import { ItemRepository } from './infra/repository/item-repository.js'
import { LocationRepository } from './infra/repository/location-repository.js'
import { MemoryRepository } from './infra/repository/memory-repository.js'
import { OutlineRepository } from './infra/repository/outline-repository.js'
import { StoryStateRepository } from './infra/repository/story-state-repository.js'
import { VolumeRepository } from './infra/repository/volume-repository.js'
import { NovelError, toErrorMessage } from './shared/utils/errors.js'
import { formatJson, formatList, formatSection } from './shared/utils/format.js'
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
const planCommand = program.command('plan').description('Planning commands')
const writeCommand = program.command('write').description('Writing commands')
const reviewCommand = program.command('review').description('Review commands')
const draftCommand = program.command('draft').description('Draft commands')
const rewriteCommand = program.command('rewrite').description('Rewrite result commands')
const stateCommand = program.command('state').description('State tracing commands')

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
const characterCommand = program.command('character').description('Manage characters')
const locationCommand = program.command('location').description('Manage locations')
const factionCommand = program.command('faction').description('Manage factions')
const hookCommand = program.command('hook').description('Manage hooks')
const itemCommand = program.command('item').description('Manage items')

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
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
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
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
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

characterCommand
  .command('add')
  .description('Add a character')
  .requiredOption('--name <name>', 'Character name')
  .requiredOption('--role <role>', 'Character role')
  .requiredOption('--profile <profile>', 'Character profile')
  .requiredOption('--motivation <motivation>', 'Character motivation')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
      )

      const character = worldService.addCharacter(options)
      console.log(`Character created: ${character.name} (${character.id})`)
    } finally {
      database.close()
    }
  })

locationCommand
  .command('add')
  .description('Add a location')
  .requiredOption('--name <name>', 'Location name')
  .requiredOption('--type <type>', 'Location type')
  .requiredOption('--description <description>', 'Location description')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
      )

      const location = worldService.addLocation(options)
      console.log(`Location created: ${location.name} (${location.id})`)
    } finally {
      database.close()
    }
  })

factionCommand
  .command('add')
  .description('Add a faction')
  .requiredOption('--name <name>', 'Faction name')
  .requiredOption('--type <type>', 'Faction type')
  .requiredOption('--objective <objective>', 'Faction objective')
  .requiredOption('--description <description>', 'Faction description')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
      )

      const faction = worldService.addFaction(options)
      console.log(`Faction created: ${faction.name} (${faction.id})`)
    } finally {
      database.close()
    }
  })

hookCommand
  .command('add')
  .description('Add a hook')
  .requiredOption('--title <title>', 'Hook title')
  .requiredOption('--description <description>', 'Hook description')
  .requiredOption('--payoff-expectation <payoffExpectation>', 'Expected payoff')
  .option('--priority <priority>', 'Hook priority', 'medium')
  .option('--source-chapter-id <sourceChapterId>', 'Source chapter id')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
      )

      const hook = worldService.addHook({
        title: options.title,
        description: options.description,
        payoffExpectation: options.payoffExpectation,
        priority: options.priority,
        sourceChapterId: options.sourceChapterId,
      })
      console.log(`Hook created: ${hook.title} (${hook.id})`)
    } finally {
      database.close()
    }
  })

itemCommand
  .command('add')
  .description('Add an item and initialize its current state')
  .requiredOption('--name <name>', 'Item name')
  .requiredOption('--unit <unit>', 'Item unit')
  .requiredOption('--type <type>', 'Item type')
  .requiredOption('--description <description>', 'Item description')
  .option('--quantity <number>', 'Item quantity', parseInteger, 1)
  .option('--status <status>', 'Item state description', '正常')
  .option('--owner-character-id <ownerCharacterId>', 'Current owner character id')
  .option('--location-id <locationId>', 'Current location id')
  .option('--important', 'Mark item as important')
  .option('--unique', 'Mark item as unique worldwide')
  .action(async (options) => {
    const database = await openProjectDatabase()

    try {
      const worldService = new WorldService(
        new BookRepository(database),
        new VolumeRepository(database),
        new ChapterRepository(database),
        new CharacterRepository(database),
        new LocationRepository(database),
        new FactionRepository(database),
        new HookRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
      )

      const item = worldService.addItem({
        name: options.name,
        unit: options.unit,
        type: options.type,
        description: options.description,
        quantity: options.quantity,
        status: options.status,
        ownerCharacterId: options.ownerCharacterId,
        locationId: options.locationId,
        isImportant: Boolean(options.important),
        isUniqueWorldwide: Boolean(options.unique),
      })

      console.log(`Item created: ${item.name} (${item.id})`)
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
        new ChapterPlanRepository(database),
        new ChapterReviewRepository(database),
        new ChapterOutputRepository(database),
        new ChapterStateUpdateRepository(database),
        new ChapterMemoryUpdateRepository(database),
        new ChapterHookUpdateRepository(database),
        new StoryStateRepository(database),
        new CharacterRepository(database),
        new CharacterCurrentStateRepository(database),
        new HookRepository(database),
        new HookStateRepository(database),
        new ItemRepository(database),
        new ItemCurrentStateRepository(database),
        new MemoryRepository(database),
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

planCommand
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
        new CharacterCurrentStateRepository(database),
        new ItemCurrentStateRepository(database),
        new MemoryRepository(database),
        new HookStateRepository(database),
      )
      const planningService = new PlanningService(
        contextBuilder,
        new ChapterPlanRepository(database),
        chapterRepository,
        createLlmAdapter(bookRepository.getFirst()),
        new HookRepository(database),
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

      console.log(`Plan version: ${plan.versionId}`)
      console.log(`Objective: ${plan.objective}`)
      console.log(formatSection('Scene cards:', formatJson(plan.sceneCards)))
      console.log(formatSection('Event outline:', formatJson(plan.eventOutline)))
      console.log(formatSection('State predictions:', formatJson(plan.statePredictions)))
      console.log(formatSection('Memory candidates:', formatJson(plan.memoryCandidates)))
    } finally {
      database.close()
    }
  })

writeCommand
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
        new CharacterCurrentStateRepository(database),
        new ItemCurrentStateRepository(database),
        new MemoryRepository(database),
        new HookStateRepository(database),
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

draftCommand
  .command('show <chapterId>')
  .description('Show the latest draft for a chapter')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const draft = new ChapterDraftRepository(database).getLatestByChapterId(chapterId)

      if (!draft) {
        throw new NovelError(`No chapter draft found for chapter: ${chapterId}`)
      }

      console.log(`Draft id: ${draft.id}`)
      console.log(`Version: ${draft.versionId}`)
      console.log(`Word count: ${draft.actualWordCount}`)
      console.log(formatSection('Content preview:', draft.content))
    } finally {
      database.close()
    }
  })

reviewCommand
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
        new CharacterCurrentStateRepository(database),
        new ItemCurrentStateRepository(database),
        new MemoryRepository(database),
        new HookStateRepository(database),
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

reviewCommand
  .command('show <chapterId>')
  .description('Show the latest review for a chapter')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const review = new ChapterReviewRepository(database).getLatestByChapterId(chapterId)

      if (!review) {
        throw new NovelError(`No chapter review found for chapter: ${chapterId}`)
      }

      console.log(`Review id: ${review.id}`)
      console.log(`Decision: ${review.decision}`)
      console.log(formatSection('Consistency issues:', formatJson(review.consistencyIssues)))
      console.log(formatSection('Character issues:', formatJson(review.characterIssues)))
      console.log(formatSection('Item issues:', formatJson(review.itemIssues)))
      console.log(formatSection('Memory issues:', formatJson(review.memoryIssues)))
      console.log(formatSection('Pacing issues:', formatJson(review.pacingIssues)))
      console.log(formatSection('Hook issues:', formatJson(review.hookIssues)))
      console.log(formatSection('New fact candidates:', formatJson(review.newFactCandidates)))
      console.log(formatSection('Word count check:', formatJson(review.wordCountCheck)))
      console.log(formatSection('Revision advice:', formatJson(review.revisionAdvice)))
    } finally {
      database.close()
    }
  })

rewriteCommand
  .command('show <chapterId>')
  .description('Show the latest rewrite candidate for a chapter')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const rewrite = new ChapterRewriteRepository(database).getLatestByChapterId(chapterId)

      if (!rewrite) {
        throw new NovelError(`No chapter rewrite found for chapter: ${chapterId}`)
      }

      console.log(`Rewrite id: ${rewrite.id}`)
      console.log(`Version: ${rewrite.versionId}`)
      console.log(`Strategy: ${rewrite.strategy}`)
      console.log(`Word count: ${rewrite.actualWordCount}`)
      console.log(formatSection('Goals:', formatJson(rewrite.goals)))
      console.log(formatSection('Content preview:', rewrite.content))
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

stateCommand
  .command('show')
  .description('Show current canonical state for the current book')
  .action(async () => {
    const database = await openProjectDatabase()

    try {
      const book = new BookRepository(database).getFirst()

      if (!book) {
        throw new NovelError('Project is not initialized. Run `novel init` first.')
      }

      const chapterRepository = new ChapterRepository(database)
      const storyState = new StoryStateRepository(database).getByBookId(book.id)
      const characterRepository = new CharacterRepository(database)
      const locationRepository = new LocationRepository(database)
      const itemRepository = new ItemRepository(database)
      const hookRepository = new HookRepository(database)
      const characterStates = new CharacterCurrentStateRepository(database).listByBookId(book.id)
      const importantItems = new ItemCurrentStateRepository(database).listImportantByBookId(book.id)
      const hookStates = new HookStateRepository(database).listByBookId(book.id)
      const shortTermMemory = new MemoryRepository(database).getShortTermByBookId(book.id)
      const longTermMemory = new MemoryRepository(database).getLongTermByBookId(book.id)
      const characters = characterRepository.listByBookId(book.id)
      const locations = locationRepository.listByBookId(book.id)
      const items = itemRepository.listByBookId(book.id)
      const hooks = hookRepository.listByBookId(book.id)
      const recentStateUpdates = new ChapterStateUpdateRepository(database).listByBookId(book.id).slice(0, 10)
      const recentMemoryUpdates = new ChapterMemoryUpdateRepository(database).listByBookId(book.id).slice(0, 10)
      const recentHookUpdates = new ChapterHookUpdateRepository(database).listByBookId(book.id).slice(0, 10)

      const characterNameById = new Map(characters.map((character) => [character.id, character.name]))
      const locationNameById = new Map(locations.map((location) => [location.id, location.name]))
      const itemNameById = new Map(items.map((item) => [item.id, item.name]))
      const hookTitleById = new Map(hooks.map((hook) => [hook.id, hook.title]))

      console.log(`Book: ${book.title}`)
      console.log(`Book ID: ${book.id}`)
      console.log(formatSection('Story current state:', formatJson({
        currentChapterId: storyState?.currentChapterId ?? null,
        currentChapterTitle: storyState?.currentChapterId
          ? chapterRepository.getById(storyState.currentChapterId)?.title ?? null
          : null,
        recentEvents: storyState?.recentEvents ?? [],
        updatedAt: storyState?.updatedAt ?? null,
      })))
      console.log(formatSection(
        'Character current state:',
        formatJson(
          characterStates.map((state) => ({
            characterId: state.characterId,
            characterName: characterNameById.get(state.characterId) ?? state.characterId,
            currentLocationId: state.currentLocationId ?? null,
            currentLocationName: state.currentLocationId ? (locationNameById.get(state.currentLocationId) ?? null) : null,
            statusNotes: state.statusNotes,
            updatedAt: state.updatedAt,
          })),
        ),
      ))
      console.log(formatSection(
        'Important item current state:',
        formatJson(
          importantItems.map((item) => ({
            itemId: item.id,
            itemName: item.name,
            ownerCharacterId: item.ownerCharacterId ?? null,
            ownerCharacterName: item.ownerCharacterId ? (characterNameById.get(item.ownerCharacterId) ?? null) : null,
            locationId: item.locationId ?? null,
            locationName: item.locationId ? (locationNameById.get(item.locationId) ?? null) : null,
            quantity: item.quantity,
            status: item.status,
            updatedAt: item.updatedAt || null,
          })),
        ),
      ))
      console.log(formatSection(
        'Hook current state:',
        formatJson(
          hookStates.map((state) => ({
            hookId: state.hookId,
            hookTitle: hookTitleById.get(state.hookId) ?? state.hookId,
            status: state.status,
            updatedByChapterId: state.updatedByChapterId ?? null,
            updatedAt: state.updatedAt,
          })),
        ),
      ))
      console.log(formatSection('Short-term memory current:', formatJson(shortTermMemory)))
      console.log(formatSection('Long-term memory current:', formatJson(longTermMemory)))
      console.log(formatSection(
        'Recent state updates:',
        formatJson(recentStateUpdates.map((update) => ({
          ...update,
          entityName:
            update.entityType === 'character'
              ? (characterNameById.get(update.entityId) ?? update.entityId)
              : (itemNameById.get(update.entityId) ?? update.entityId),
        }))),
      ))
      console.log(formatSection('Recent memory updates:', formatJson(recentMemoryUpdates)))
      console.log(formatSection(
        'Recent hook updates:',
        formatJson(recentHookUpdates.map((update) => ({
          ...update,
          hookTitle: hookTitleById.get(update.hookId) ?? update.hookId,
        }))),
      ))
    } finally {
      database.close()
    }
  })

program
  .command('state-updates')
  .description('State update trace commands')
  .command('show <chapterId>')
  .description('Show state, memory, and hook updates for a chapter')
  .action(async (chapterId: string) => {
    const database = await openProjectDatabase()

    try {
      const chapterRepository = new ChapterRepository(database)
      const characterRepository = new CharacterRepository(database)
      const itemRepository = new ItemRepository(database)
      const hookRepository = new HookRepository(database)
      const chapter = chapterRepository.getById(chapterId)
      const stateUpdates = new ChapterStateUpdateRepository(database).listByChapterId(chapterId)
      const memoryUpdates = new ChapterMemoryUpdateRepository(database).listByChapterId(chapterId)
      const hookUpdates = new ChapterHookUpdateRepository(database).listByChapterId(chapterId)
      const characterNameById = new Map(characterRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]))
      const itemNameById = new Map(itemRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]))
      const hookTitleById = new Map(hookRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.title]))

      if (chapter) {
        console.log(`Chapter: #${chapter.index} ${chapter.title}`)
        console.log(`Chapter ID: ${chapter.id}`)
        console.log(`Status: ${chapter.status}`)
      }

      console.log(formatSection(
        'State updates:',
        formatJson(stateUpdates.map((update) => ({
          ...update,
          entityName:
            update.entityType === 'character'
              ? (characterNameById.get(update.entityId) ?? update.entityId)
              : (itemNameById.get(update.entityId) ?? update.entityId),
        }))),
      ))
      console.log(formatSection('Memory updates:', formatJson(memoryUpdates)))
      console.log(formatSection(
        'Hook updates:',
        formatJson(hookUpdates.map((update) => ({
          ...update,
          hookTitle: hookTitleById.get(update.hookId) ?? update.hookId,
        }))),
      ))
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
