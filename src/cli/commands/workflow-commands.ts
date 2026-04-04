import { Command } from 'commander'

import { PlanningContextBuilder } from '../../core/context/planning-context-builder.js'
import { WritingContextBuilder } from '../../core/context/writing-context-builder.js'
import { GenerationService } from '../../core/generation/service.js'
import { PlanningService } from '../../core/planning/service.js'
import { ReviewService } from '../../core/review/service.js'
import { createLlmAdapter } from '../../infra/llm/factory.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { EndingReadinessRepository } from '../../infra/repository/ending-readiness-repository.js'
import { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import { OutlineRepository } from '../../infra/repository/outline-repository.js'
import { StoryThreadRepository } from '../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../infra/repository/volume-plan-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../shared/utils/format.js'
import { openProjectDatabase, runLoggedCommand } from '../context.js'

export function registerWorkflowCommands(program: Command): void {
  const planCommand = program.command('plan').description('Planning commands')
  const writeCommand = program.command('write').description('Writing commands')
  const reviewCommand = program.command('review').description('Review commands')
  const draftCommand = program.command('draft').description('Draft commands')
  const rewriteCommand = program.command('rewrite').description('Rewrite result commands')

  planCommand
    .command('chapter <chapterId>')
    .description('Generate a chapter plan')
    .action(async (chapterId: string) => {
      const plan = await runLoggedCommand({
        command: 'plan chapter',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const bookRepository = new BookRepository(database)
          const outlineRepository = new OutlineRepository(database)
          const chapterRepository = new ChapterRepository(database)
          const volumeRepository = new VolumeRepository(database)
          const contextBuilder = new PlanningContextBuilder(
            bookRepository,
            outlineRepository,
            chapterRepository,
            volumeRepository,
            new VolumePlanRepository(database),
            new StoryThreadRepository(database),
            new EndingReadinessRepository(database),
            new CharacterCurrentStateRepository(database),
            new CharacterArcRepository(database),
            new ItemCurrentStateRepository(database),
            new MemoryRepository(database),
            new HookStateRepository(database),
            new HookPressureRepository(database),
            new NarrativeDebtRepository(database),
          )
          const planningService = new PlanningService(
            contextBuilder,
            new ChapterPlanRepository(database),
            chapterRepository,
            createLlmAdapter(),
            new HookRepository(database),
          )

          const result = await planningService.planChapter(chapterId)

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter plan created: ${result.versionId}`,
            detail: {
              planVersionId: result.versionId,
              objective: result.objective,
              sceneCount: result.sceneCards.length,
              hookPlanCount: result.hookPlan.length,
              statePredictionCount: result.statePredictions.length,
            },
          }
        },
      })

      console.log(`Chapter plan created: ${plan.versionId}`)
      console.log(`Objective: ${plan.objective}`)
      console.log(`Scenes: ${plan.sceneCards.length}`)
      console.log(`Events: ${plan.eventOutline.length}`)
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
        console.log(formatSection('Mission id:', plan.missionId ?? '(none)'))
        console.log(formatSection('Thread focus:', formatJson(plan.threadFocus)))
        console.log(formatSection('Window role:', plan.windowRole ?? '(none)'))
        console.log(formatSection('Carry-in tasks:', formatJson(plan.carryInTasks)))
        console.log(formatSection('Carry-out tasks:', formatJson(plan.carryOutTasks)))
        console.log(formatSection('Scene cards:', formatJson(plan.sceneCards)))
        console.log(formatSection('Scene goals:', formatJson(plan.sceneGoals)))
        console.log(formatSection('Scene constraints:', formatJson(plan.sceneConstraints)))
        console.log(formatSection('Scene emotional targets:', formatJson(plan.sceneEmotionalTargets)))
        console.log(formatSection('Scene outcome checklist:', formatJson(plan.sceneOutcomeChecklist)))
        console.log(formatSection('Event outline:', formatJson(plan.eventOutline)))
        console.log(formatSection('State predictions:', formatJson(plan.statePredictions)))
        console.log(formatSection('High pressure hooks:', formatJson(plan.highPressureHookIds)))
        console.log(formatSection('Character arc targets:', formatJson(plan.characterArcTargets)))
        console.log(formatSection('Debt carry targets:', formatJson(plan.debtCarryTargets)))
        console.log(formatSection('Ending drive:', plan.endingDrive))
        console.log(formatSection('Must resolve debts:', formatJson(plan.mustResolveDebts)))
        console.log(formatSection('Must advance hooks:', formatJson(plan.mustAdvanceHooks)))
        console.log(formatSection('Must preserve facts:', formatJson(plan.mustPreserveFacts)))
        console.log(formatSection('Memory candidates:', formatJson(plan.memoryCandidates)))
      } finally {
        database.close()
      }
    })

  writeCommand
    .command('next <chapterId>')
    .description('Generate the next chapter draft from the latest plan')
    .action(async (chapterId: string) => {
      const result = await runLoggedCommand({
        command: 'write next',
        args: [chapterId],
        chapterId,
        action: async (database) => {
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
            new VolumePlanRepository(database),
            new StoryThreadRepository(database),
            new EndingReadinessRepository(database),
            new CharacterCurrentStateRepository(database),
            new CharacterArcRepository(database),
            new ItemCurrentStateRepository(database),
            new MemoryRepository(database),
            new HookStateRepository(database),
            new HookPressureRepository(database),
            new NarrativeDebtRepository(database),
          )
          const writingContextBuilder = new WritingContextBuilder(
            planningContextBuilder,
            chapterPlanRepository,
          )
          const generationService = new GenerationService(
            writingContextBuilder,
            new ChapterDraftRepository(database),
            chapterRepository,
            createLlmAdapter(),
          )

          const writeResult = await generationService.writeNext(chapterId)

          return {
            result: writeResult,
            chapterId,
            summary: `Chapter draft created: ${writeResult.draftId}`,
            detail: {
              draftId: writeResult.draftId,
              chapterStatus: writeResult.chapterStatus,
              wordCount: writeResult.actualWordCount,
              nextAction: writeResult.nextAction,
            },
          }
        },
      })

      console.log(`Chapter draft created: ${result.draftId}`)
      console.log(`Status: ${result.chapterStatus}`)
      console.log(`Word count: ${result.actualWordCount}`)
      console.log(`Next action: ${result.nextAction}`)
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
      const review = await runLoggedCommand({
        command: 'review chapter',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const reviewService = new ReviewService(
            new BookRepository(database),
            new ChapterRepository(database),
            new ChapterPlanRepository(database),
            new ChapterDraftRepository(database),
            new ChapterReviewRepository(database),
            new CharacterCurrentStateRepository(database),
            new CharacterArcRepository(database),
            new ItemCurrentStateRepository(database),
            new MemoryRepository(database),
            new HookRepository(database),
            new HookStateRepository(database),
            new HookPressureRepository(database),
            new NarrativeDebtRepository(database),
            createLlmAdapter(),
          )

          const result = await reviewService.reviewChapter(chapterId)

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter review created: ${result.id}`,
            detail: {
              reviewId: result.id,
              decision: result.decision,
              approvalRisk: result.approvalRisk,
              issueCount:
                result.consistencyIssues.length +
                result.characterIssues.length +
                result.itemIssues.length +
                result.memoryIssues.length +
                result.pacingIssues.length +
                result.hookIssues.length,
              closureCounts: {
                characters: result.closureSuggestions.characters.length,
                items: result.closureSuggestions.items.length,
                hooks: result.closureSuggestions.hooks.length,
                memory: result.closureSuggestions.memory.length,
              },
            },
          }
        },
      })

      console.log(`Chapter review created: ${review.id}`)
      console.log(`Decision: ${review.decision}`)
      console.log(`Approval risk: ${review.approvalRisk}`)
      console.log(`Word count passed: ${review.wordCountCheck.passed}`)
      console.log(
        `Closure suggestions: ${review.closureSuggestions.characters.length + review.closureSuggestions.items.length + review.closureSuggestions.hooks.length + review.closureSuggestions.memory.length}`,
      )
      console.log(`Revision advice: ${review.revisionAdvice.join('；')}`)
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
        console.log(`Approval risk: ${review.approvalRisk}`)
        console.log(formatSection('Consistency issues:', formatJson(review.consistencyIssues)))
        console.log(formatSection('Character issues:', formatJson(review.characterIssues)))
        console.log(formatSection('Item issues:', formatJson(review.itemIssues)))
        console.log(formatSection('Memory issues:', formatJson(review.memoryIssues)))
        console.log(formatSection('Pacing issues:', formatJson(review.pacingIssues)))
        console.log(formatSection('Hook issues:', formatJson(review.hookIssues)))
        console.log(formatSection('Must-fix issues:', formatJson(review.reviewLayers.mustFix)))
        console.log(formatSection('Narrative quality issues:', formatJson(review.reviewLayers.narrativeQuality)))
        console.log(formatSection('Language quality issues:', formatJson(review.reviewLayers.languageQuality)))
        console.log(formatSection('Rewrite strategy suggestion:', formatJson(review.reviewLayers.rewriteStrategySuggestion)))
        console.log(formatSection('New fact candidates:', formatJson(review.newFactCandidates)))
        console.log(formatSection('Outcome candidate:', formatJson(review.outcomeCandidate)))
        console.log(formatSection('Closure suggestions:', formatJson(review.closureSuggestions)))
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
        console.log(`Primary rewrite strategy: ${rewrite.strategyProfile.primary}`)
        console.log(`Word count: ${rewrite.actualWordCount}`)
        console.log(formatSection('Rewrite strategy profile:', formatJson(rewrite.strategyProfile)))
        console.log(formatSection('Rewrite quality target:', formatJson(rewrite.qualityTarget)))
        console.log(formatSection('Validation:', formatJson(rewrite.validation)))
        console.log(formatSection('Goals:', formatJson(rewrite.goals)))
        console.log(formatSection('Content preview:', rewrite.content))
      } finally {
        database.close()
      }
    })
}
