import { Command } from 'commander'

import { CharacterRepository } from '../../../infra/repository/character-repository.js'
import { ChapterHookUpdateRepository } from '../../../infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../../infra/repository/chapter-memory-update-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterStateUpdateRepository } from '../../../infra/repository/chapter-state-update-repository.js'
import { HookRepository } from '../../../infra/repository/hook-repository.js'
import { ItemRepository } from '../../../infra/repository/item-repository.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'
import { runLoggedCommand } from '../../context.js'
import { formatTrace, summarizeClosureSuggestions } from '../state/shared.js'

export function registerStateUpdatesShowCommand(stateUpdatesCommand: Command): void {
  stateUpdatesCommand
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
