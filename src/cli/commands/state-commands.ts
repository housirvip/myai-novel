import { Command } from 'commander'

import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { CharacterRepository } from '../../infra/repository/character-repository.js'
import { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../infra/repository/item-repository.js'
import { LocationRepository } from '../../infra/repository/location-repository.js'
import { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import { EndingReadinessRepository } from '../../infra/repository/ending-readiness-repository.js'
import { StoryThreadRepository } from '../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../infra/repository/volume-plan-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../shared/utils/format.js'
import { openProjectDatabase, runLoggedCommand } from '../context.js'

export function registerStateCommands(program: Command): void {
  registerStoryCommand(program)

  const stateCommand = program.command('state').description('State tracing commands')

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
        const chapters = chapterRepository.listByBookId(book.id)
        const storyState = new StoryStateRepository(database).getByBookId(book.id)
        const characterRepository = new CharacterRepository(database)
        const locationRepository = new LocationRepository(database)
        const itemRepository = new ItemRepository(database)
        const hookRepository = new HookRepository(database)
        const characterStates = new CharacterCurrentStateRepository(database).listByBookId(book.id)
        const characterArcs = new CharacterArcRepository(database).listByBookId(book.id)
        const importantItems = new ItemCurrentStateRepository(database).listImportantByBookId(book.id)
        const hookStates = new HookStateRepository(database).listByBookId(book.id)
        const hookPressures = new HookPressureRepository(database).listActiveByBookId(book.id)
        const activeStoryThreads = new StoryThreadRepository(database).listActiveByBookId(book.id)
        const endingReadiness = new EndingReadinessRepository(database).getByBookId(book.id)
        const latestVolumePlans = [...new Set(chapters.map((chapter) => chapter.volumeId))]
          .map((volumeId) => new VolumePlanRepository(database).getLatestByVolumeId(volumeId))
          .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan))
        const openNarrativeDebts = new NarrativeDebtRepository(database).listOpenByBookId(book.id)
        const memoryRepository = new MemoryRepository(database)
        const shortTermMemory = memoryRepository.getShortTermByBookId(book.id)
        const observationMemory = memoryRepository.getObservationByBookId(book.id)
        const longTermMemory = memoryRepository.getLongTermByBookId(book.id)
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
          formatJson(characterStates.map((state) => ({
            characterId: state.characterId,
            characterName: characterNameById.get(state.characterId) ?? state.characterId,
            currentLocationId: state.currentLocationId ?? null,
            currentLocationName: state.currentLocationId ? (locationNameById.get(state.currentLocationId) ?? null) : null,
            statusNotes: state.statusNotes,
            updatedAt: state.updatedAt,
          }))),
        ))
        console.log(formatSection(
          'Important item current state:',
          formatJson(importantItems.map((item) => ({
            itemId: item.id,
            itemName: item.name,
            ownerCharacterId: item.ownerCharacterId ?? null,
            ownerCharacterName: item.ownerCharacterId ? (characterNameById.get(item.ownerCharacterId) ?? null) : null,
            locationId: item.locationId ?? null,
            locationName: item.locationId ? (locationNameById.get(item.locationId) ?? null) : null,
            quantity: item.quantity,
            status: item.status,
            updatedAt: item.updatedAt || null,
          }))),
        ))
        console.log(formatSection(
          'Hook current state:',
          formatJson(hookStates.map((state) => ({
            hookId: state.hookId,
            hookTitle: hookTitleById.get(state.hookId) ?? state.hookId,
            status: state.status,
            updatedByChapterId: state.updatedByChapterId ?? null,
            updatedAt: state.updatedAt,
          }))),
        ))
        console.log(formatSection('Character arc current state:', formatJson(characterArcs)))
        console.log(formatSection('Hook pressure current:', formatJson(hookPressures)))
        console.log(formatSection('Active story threads:', formatJson(activeStoryThreads)))
        console.log(formatSection('Latest volume plans:', formatJson(latestVolumePlans)))
        console.log(formatSection('Ending readiness current:', formatJson(endingReadiness)))
        console.log(formatSection('Open narrative debts:', formatJson(openNarrativeDebts)))
        console.log(formatSection('Short-term memory current:', formatJson(shortTermMemory)))
        console.log(formatSection('Observation memory current:', formatJson(observationMemory)))
        console.log(formatSection('Long-term memory current:', formatJson(longTermMemory)))
        console.log(formatSection(
          'Recent state updates:',
          formatJson(recentStateUpdates.map((update) => ({
            ...update,
            entityName:
              update.entityType === 'character'
                ? (characterNameById.get(update.entityId) ?? update.entityId)
                : (itemNameById.get(update.entityId) ?? update.entityId),
            trace: formatTrace(update.detail),
          }))),
        ))
        console.log(formatSection(
          'Recent memory updates:',
          formatJson(recentMemoryUpdates.map((update) => ({
            ...update,
            trace: formatTrace(update.detail),
          }))),
        ))
        console.log(formatSection(
          'Recent hook updates:',
          formatJson(recentHookUpdates.map((update) => ({
            ...update,
            hookTitle: hookTitleById.get(update.hookId) ?? update.hookId,
            trace: formatTrace(update.detail),
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
      const output = await runLoggedCommand({
        command: 'state-updates show',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const chapterRepository = new ChapterRepository(database)
          const characterRepository = new CharacterRepository(database)
          const itemRepository = new ItemRepository(database)
          const hookRepository = new HookRepository(database)
          const chapter = chapterRepository.getById(chapterId)
          const review = new ChapterReviewRepository(database).getLatestByChapterId(chapterId)
          const stateUpdates = new ChapterStateUpdateRepository(database).listByChapterId(chapterId)
          const memoryUpdates = new ChapterMemoryUpdateRepository(database).listByChapterId(chapterId)
          const hookUpdates = new ChapterHookUpdateRepository(database).listByChapterId(chapterId)
          const characterNameById = new Map(
            characterRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]),
          )
          const itemNameById = new Map(itemRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.name]))
          const hookTitleById = new Map(hookRepository.listByBookId(chapter?.bookId ?? '').map((item) => [item.id, item.title]))

          const result = {
            chapter,
            review,
            stateUpdates,
            memoryUpdates,
            hookUpdates,
            characterNameById,
            itemNameById,
            hookTitleById,
          }

          return {
            result,
            chapterId,
            bookId: chapter?.bookId,
            summary: `State updates loaded for chapter: ${chapterId}`,
            detail: {
              stateUpdateCount: stateUpdates.length,
              memoryUpdateCount: memoryUpdates.length,
              hookUpdateCount: hookUpdates.length,
              reviewId: review?.id,
            },
          }
        },
      })

      if (output.chapter) {
        console.log(`Chapter: #${output.chapter.index} ${output.chapter.title}`)
        console.log(`Chapter ID: ${output.chapter.id}`)
        console.log(`Status: ${output.chapter.status}`)
      }

      if (output.review) {
        console.log(formatSection(
          'Latest review:',
          formatJson({
            reviewId: output.review.id,
            decision: output.review.decision,
            approvalRisk: output.review.approvalRisk,
            closureSummary: summarizeClosureSuggestions(output.review.closureSuggestions),
            topIssues: [
              ...output.review.consistencyIssues,
              ...output.review.characterIssues,
              ...output.review.itemIssues,
              ...output.review.memoryIssues,
              ...output.review.hookIssues,
            ].slice(0, 5),
            revisionAdvice: output.review.revisionAdvice.slice(0, 5),
          }),
        ))
        console.log(formatSection('Review closure suggestions:', formatJson(output.review.closureSuggestions)))
      }

      console.log(formatSection(
        'State updates:',
        formatJson(output.stateUpdates.map((update) => ({
          ...update,
          entityName:
            update.entityType === 'character'
              ? (output.characterNameById.get(update.entityId) ?? update.entityId)
              : (output.itemNameById.get(update.entityId) ?? update.entityId),
          trace: formatTrace(update.detail),
        }))),
      ))
      console.log(formatSection(
        'Memory updates:',
        formatJson(output.memoryUpdates.map((update) => ({
          ...update,
          trace: formatTrace(update.detail),
        }))),
      ))
      console.log(formatSection(
        'Hook updates:',
        formatJson(output.hookUpdates.map((update) => ({
          ...update,
          hookTitle: output.hookTitleById.get(update.hookId) ?? update.hookId,
          trace: formatTrace(update.detail),
        }))),
      ))
    })
}

function registerStoryCommand(program: Command): void {
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

function formatTrace(detail: {
  source: string
  reason: string
  evidence: string[]
  evidenceSummary?: string
  before?: string
  after?: string
  previousValueSummary?: string
  nextValueSummary?: string
}): string {
  return [
    `source=${detail.source}`,
    `reason=${detail.reason}`,
    `before=${detail.previousValueSummary ?? detail.before ?? 'N/A'}`,
    `after=${detail.nextValueSummary ?? detail.after ?? 'N/A'}`,
    `evidence=${detail.evidenceSummary ?? (detail.evidence.join(' | ') || 'N/A')}`,
  ].join('；')
}

function summarizeClosureSuggestions(closureSuggestions: {
  characters: unknown[]
  items: unknown[]
  hooks: unknown[]
  memory: unknown[]
}): { total: number; characters: number; items: number; hooks: number; memory: number } {
  return {
    total:
      closureSuggestions.characters.length +
      closureSuggestions.items.length +
      closureSuggestions.hooks.length +
      closureSuggestions.memory.length,
    characters: closureSuggestions.characters.length,
    items: closureSuggestions.items.length,
    hooks: closureSuggestions.hooks.length,
    memory: closureSuggestions.memory.length,
  }
}
