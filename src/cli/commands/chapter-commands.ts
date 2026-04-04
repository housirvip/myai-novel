import { Command } from 'commander'

import { ApproveService } from '../../core/approve/service.js'
import { ChapterDropService } from '../../core/chapter-drop/service.js'
import { RewriteService } from '../../core/rewrite/service.js'
import { WorldService } from '../../core/world/service.js'
import type { NovelDatabase } from '../../infra/db/database.js'
import { createLlmAdapter } from '../../infra/llm/factory.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import { ChapterContradictionRepository } from '../../infra/repository/chapter-contradiction-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { CharacterRepository } from '../../infra/repository/character-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import { ChapterOutcomeRepository } from '../../infra/repository/chapter-outcome-repository.js'
import { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import { FactionRepository } from '../../infra/repository/faction-repository.js'
import { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../infra/repository/item-repository.js'
import { LocationRepository } from '../../infra/repository/location-repository.js'
import { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'
import type { DropChapterMode } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { nowIso } from '../../shared/utils/time.js'
import { openProjectDatabase, parseInteger, runLoggedCommand } from '../context.js'

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
        const outcomeRepository = new ChapterOutcomeRepository(database)
        const narrativeDebtRepository = new NarrativeDebtRepository(database)
        const contradictionRepository = new ChapterContradictionRepository(database)
        const stateUpdateRepository = new ChapterStateUpdateRepository(database)
        const memoryUpdateRepository = new ChapterMemoryUpdateRepository(database)
        const hookUpdateRepository = new ChapterHookUpdateRepository(database)
        const chapter = chapterRepository.getById(chapterId)

        if (!chapter) {
          throw new NovelError(`Chapter not found: ${chapterId}`)
        }

        const latestPlan = planRepository.getLatestByChapterId(chapterId)
        const latestDraft = draftRepository.getLatestByChapterId(chapterId)
        const latestReview = reviewRepository.getLatestByChapterId(chapterId)
        const latestRewrite = rewriteRepository.getLatestByChapterId(chapterId)
        const latestOutput = outputRepository.getLatestByChapterId(chapterId)
        const latestOutcome = outcomeRepository.getLatestByChapterId(chapterId)
        const chapterDebts = narrativeDebtRepository.listByChapterId(chapterId)
        const chapterContradictions = contradictionRepository.listByChapterId(chapterId)
        const latestStateUpdates = stateUpdateRepository.listByChapterId(chapterId)
        const latestMemoryUpdates = memoryUpdateRepository.listByChapterId(chapterId)
        const latestHookUpdates = hookUpdateRepository.listByChapterId(chapterId)

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
          console.log(`Latest review risk: ${latestReview.approvalRisk}`)
          console.log(`Latest review closures: ${latestReview.closureSuggestions.characters.length + latestReview.closureSuggestions.items.length + latestReview.closureSuggestions.hooks.length + latestReview.closureSuggestions.memory.length}`)
          console.log(`Latest review advice: ${latestReview.revisionAdvice.slice(0, 2).join('；') || '(none)'}`)
        }

        if (latestRewrite) {
          console.log(`Latest rewrite: ${latestRewrite.id} (${latestRewrite.actualWordCount} chars)`)
        }

        if (latestOutput) {
          console.log(`Final output: ${latestOutput.finalPath}`)
        }

        if (latestOutcome) {
          console.log(`Latest outcome: ${latestOutcome.id} [${latestOutcome.decision}]`)
          console.log(`Outcome facts: ${latestOutcome.resolvedFacts.length}`)
          console.log(`Outcome debts: ${chapterDebts.length}`)
          console.log(`Outcome contradictions: ${chapterContradictions.length}`)
        }

        console.log(`Trace summary: state=${latestStateUpdates.length}; memory=${latestMemoryUpdates.length}; hook=${latestHookUpdates.length}`)

        if (latestStateUpdates[0]) {
          console.log(`Latest state trace: ${latestStateUpdates[0].summary}`)
        }

        if (latestMemoryUpdates[0]) {
          console.log(`Latest memory trace: ${latestMemoryUpdates[0].summary}`)
        }

        if (latestHookUpdates[0]) {
          console.log(`Latest hook trace: ${latestHookUpdates[0].summary}`)
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
      const strategy = options.strategy === 'full' ? 'full' : 'partial'
      const goals = options.goal ?? ['优化节奏与结尾牵引']
      const rewrite = await runLoggedCommand({
        command: 'chapter rewrite',
        args: buildRewriteArgs(chapterId, strategy, goals),
        chapterId,
        detail: { strategy, goals },
        action: async (database) => {
          const rewriteService = new RewriteService(
            new BookRepository(database),
            new ChapterRepository(database),
            new ChapterDraftRepository(database),
            new ChapterPlanRepository(database),
            new ChapterReviewRepository(database),
            new ChapterRewriteRepository(database),
            new CharacterCurrentStateRepository(database),
            new ItemCurrentStateRepository(database),
            new HookStateRepository(database),
            new MemoryRepository(database),
            createLlmAdapter(),
          )

          const result = await rewriteService.rewriteChapter({
            chapterId,
            strategy,
            goals,
            preserveFacts: true,
            preserveHooks: true,
            preserveEndingBeat: true,
          })

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter rewrite created: ${result.id}`,
            detail: {
              rewriteId: result.id,
              versionId: result.versionId,
              strategy: result.strategy,
              goals: result.goals,
              wordCount: result.actualWordCount,
              validation: result.validation,
            },
          }
        },
      })

      console.log(`Chapter rewrite created: ${rewrite.id}`)
      console.log(`Version: ${rewrite.versionId}`)
      console.log(`Word count: ${rewrite.actualWordCount}`)
      console.log(`Goals: ${rewrite.goals.join('；')}`)
    })

  chapterCommand
    .command('approve <chapterId>')
    .description('Approve the latest reviewed chapter and export the final output')
    .option('--force', 'Approve even when the latest review risk is high')
    .action(async (chapterId: string, options) => {
      const force = Boolean(options.force)
      const result = await runLoggedCommand({
        command: 'chapter approve',
        args: buildApproveArgs(chapterId, force),
        chapterId,
        detail: { force },
        action: async (database) => {
          const approveService = new ApproveService(
            process.cwd(),
            new BookRepository(database),
            new ChapterRepository(database),
            new ChapterDraftRepository(database),
            new ChapterRewriteRepository(database),
            new ChapterPlanRepository(database),
            new ChapterReviewRepository(database),
            new ChapterOutcomeRepository(database),
            new NarrativeDebtRepository(database),
            new ChapterContradictionRepository(database),
            new ChapterOutputRepository(database),
            new ChapterStateUpdateRepository(database),
            new ChapterMemoryUpdateRepository(database),
            new ChapterHookUpdateRepository(database),
            new StoryStateRepository(database),
            new CharacterRepository(database),
            new CharacterCurrentStateRepository(database),
            new CharacterArcRepository(database),
            new HookRepository(database),
            new HookStateRepository(database),
            new HookPressureRepository(database),
            new ItemRepository(database),
            new ItemCurrentStateRepository(database),
            new MemoryRepository(database),
          )

          const approveResult = await approveService.approveChapter(chapterId, { force })

          return {
            result: approveResult,
            chapterId,
            summary: `Chapter approved: ${approveResult.chapterId}`,
            detail: {
              chapterStatus: approveResult.chapterStatus,
              versionId: approveResult.versionId,
              finalPath: approveResult.finalPath,
              approvedAt: approveResult.approvedAt,
              forcedApproval: approveResult.forcedApproval,
              stateUpdated: approveResult.stateUpdated,
              memoryUpdated: approveResult.memoryUpdated,
              hooksUpdated: approveResult.hooksUpdated,
            },
          }
        },
      })

      console.log(`Chapter approved: ${result.chapterId}`)
      console.log(`Status: ${result.chapterStatus}`)
      console.log(`Forced approval: ${result.forcedApproval}`)
      console.log(`Final path: ${result.finalPath}`)
      console.log(`Approved at: ${result.approvedAt}`)
    })

  chapterCommand
    .command('drop <chapterId>')
    .description('Drop current plan and/or draft chain for a chapter')
    .option('--plan-only', 'Drop current plan only')
    .option('--draft-only', 'Drop current draft chain only')
    .option('--all-current', 'Drop current plan and current draft chain')
    .option('--force', 'Allow drop for finalized chapters or chapters with finalized output')
    .action(async (chapterId: string, options) => {
      const dropMode = resolveDropMode(options)
      const force = Boolean(options.force)
      const result = await runLoggedCommand({
        command: 'chapter drop',
        args: buildDropArgs(chapterId, dropMode, force),
        chapterId,
        detail: { dropMode, force },
        action: async (database) => {
          const dropService = new ChapterDropService(
            new ChapterRepository(database),
            new ChapterPlanRepository(database),
            new ChapterDraftRepository(database),
            new ChapterReviewRepository(database),
            new ChapterRewriteRepository(database),
            new ChapterOutputRepository(database),
          )

          const dropResult = dropService.dropChapter({
            chapterId,
            dropMode,
            force,
            command: 'chapter drop',
            args: buildDropArgs(chapterId, dropMode, force),
            requestedAt: nowIso(),
          })

          return {
            result: dropResult,
            chapterId,
            summary: `Chapter drop applied: ${chapterId}`,
            detail: {
              dropMode: dropResult.dropMode,
              previousChapterStatus: dropResult.previousChapterStatus,
              nextChapterStatus: dropResult.nextChapterStatus,
              droppedPlanVersionId: dropResult.droppedPlanVersionId,
              droppedDraftVersionId: dropResult.droppedDraftVersionId,
              droppedReviewId: dropResult.droppedReviewId,
              droppedRewriteId: dropResult.droppedRewriteId,
              timestamp: dropResult.timestamp,
            },
          }
        },
      })

      console.log(`Chapter drop applied: ${result.chapterId}`)
      console.log(`Mode: ${result.dropMode}`)
      console.log(`Status: ${result.previousChapterStatus} -> ${result.nextChapterStatus}`)
      console.log(`Dropped plan: ${result.droppedPlanVersionId ?? '(none)'}`)
      console.log(`Dropped draft chain: ${result.droppedDraftVersionId ?? '(none)'}`)
      console.log(`Dropped review: ${result.droppedReviewId ?? '(none)'}`)
      console.log(`Dropped rewrite: ${result.droppedRewriteId ?? '(none)'}`)
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

function resolveDropMode(options: {
  planOnly?: boolean
  draftOnly?: boolean
  allCurrent?: boolean
}): DropChapterMode {
  const selectedModes = [options.planOnly, options.draftOnly, options.allCurrent].filter(Boolean).length

  if (selectedModes > 1) {
    throw new NovelError('Only one of --plan-only, --draft-only, or --all-current can be used.')
  }

  if (options.planOnly) {
    return 'plan-only'
  }

  if (options.draftOnly) {
    return 'draft-only'
  }

  return 'all-current'
}

function buildRewriteArgs(chapterId: string, strategy: 'full' | 'partial', goals: string[]): string[] {
  return [chapterId, '--strategy', strategy, ...goals.flatMap((goal) => ['--goal', goal])]
}

function buildApproveArgs(chapterId: string, force: boolean): string[] {
  return force ? [chapterId, '--force'] : [chapterId]
}

function buildDropArgs(chapterId: string, dropMode: DropChapterMode, force: boolean): string[] {
  const args = [chapterId]

  if (dropMode === 'plan-only') {
    args.push('--plan-only')
  }

  if (dropMode === 'draft-only') {
    args.push('--draft-only')
  }

  if (dropMode === 'all-current') {
    args.push('--all-current')
  }

  if (force) {
    args.push('--force')
  }

  return args
}
