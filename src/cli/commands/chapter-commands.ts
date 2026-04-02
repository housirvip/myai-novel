import { Command } from 'commander'

import { ApproveService } from '../../core/approve/service.js'
import { RewriteService } from '../../core/rewrite/service.js'
import { WorldService } from '../../core/world/service.js'
import type { NovelDatabase } from '../../infra/db/database.js'
import { createLlmAdapter } from '../../infra/llm/factory.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { CharacterRepository } from '../../infra/repository/character-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import { FactionRepository } from '../../infra/repository/faction-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../infra/repository/item-repository.js'
import { LocationRepository } from '../../infra/repository/location-repository.js'
import { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { openProjectDatabase, parseInteger } from '../context.js'

export function registerChapterCommands(program: Command): void {
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
        const chapter = createWorldService(database).addChapter({
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
          createLlmAdapter(),
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
}

function createWorldService(database: NovelDatabase): WorldService {
  return new WorldService(
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
}
