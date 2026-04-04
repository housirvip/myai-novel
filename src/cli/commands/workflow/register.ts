import { Command } from 'commander'

import { registerWorkflowDraftShowCommand } from './draft-show.js'
import { registerWorkflowPlanChapterCommand } from './plan-chapter.js'
import { registerWorkflowPlanShowCommand } from './plan-show.js'
import { registerWorkflowReviewChapterCommand } from './review-chapter.js'
import { registerWorkflowReviewShowCommand } from './review-show.js'
import { registerWorkflowRewriteShowCommand } from './rewrite-show.js'
import { registerWorkflowWriteNextCommand } from './write-next.js'

export function registerWorkflowCommands(program: Command): void {
  const planCommand = program.command('plan').description('Planning commands')
  const writeCommand = program.command('write').description('Writing commands')
  const reviewCommand = program.command('review').description('Review commands')
  const draftCommand = program.command('draft').description('Draft commands')
  const rewriteCommand = program.command('rewrite').description('Rewrite result commands')

  registerWorkflowPlanChapterCommand(planCommand)
  registerWorkflowPlanShowCommand(planCommand)
  registerWorkflowWriteNextCommand(writeCommand)
  registerWorkflowDraftShowCommand(draftCommand)
  registerWorkflowReviewChapterCommand(reviewCommand)
  registerWorkflowReviewShowCommand(reviewCommand)
  registerWorkflowRewriteShowCommand(rewriteCommand)
}
