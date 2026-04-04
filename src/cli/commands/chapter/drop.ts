import { Command } from 'commander'

import type { DropChapterMode } from '../../../shared/types/domain.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { nowIso } from '../../../shared/utils/time.js'
import { createChapterDropService } from '../chapter-services.js'
import { printChapterDropApplied } from '../chapter-printers.js'
import { runLoggedCommand } from '../../context.js'

export function registerChapterDropCommand(chapterCommand: Command): void {
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
