import { Command } from 'commander'

import { ChapterContradictionRepository } from '../../infra/repository/chapter-contradiction-repository.js'
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
import { createChapterApproveService, createChapterDropService, createChapterRewriteService, createChapterWorldService } from './chapter-services.js'
import {
  printChapterApproved,
  printChapterCreated,
  printChapterDropApplied,
  printChapterRewriteCreated,
  printChapterShowSummary,
} from './chapter-printers.js'
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

        printChapterShowSummary({
          chapter,
          latestPlan,
          latestDraft,
          latestReview,
          latestRewrite,
          latestOutput,
          latestOutcome,
          chapterDebts,
          chapterContradictions,
          latestStateUpdates,
          latestMemoryUpdates,
          latestHookUpdates,
        })
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
          const rewriteService = createChapterRewriteService(database)

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

      printChapterRewriteCreated(rewrite)
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
          const approveService = createChapterApproveService(database, process.cwd())

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
              threadProgressUpdated: approveResult.threadProgressUpdated,
              endingReadinessUpdated: approveResult.endingReadinessUpdated,
            },
          }
        },
      })

      printChapterApproved(result)
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
          const dropService = createChapterDropService(database)

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

      printChapterDropApplied(result)
    })
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
