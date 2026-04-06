import { Command } from 'commander'

import { registerWorkflowDraftShowCommand } from './draft-show.js'
import { registerWorkflowPlanChapterCommand } from './plan-chapter.js'
import { registerWorkflowPlanMissionShowCommand } from './plan-mission-show.js'
import { registerWorkflowPlanShowCommand } from './plan-show.js'
import { registerWorkflowPlanVolumeShowCommand } from './plan-volume-show.js'
import { registerWorkflowPlanVolumeWindowCommand } from './plan-volume-window.js'
import { registerWorkflowReviewChapterCommand } from './review-chapter.js'
import { registerWorkflowReviewShowCommand } from './review-show.js'
import { registerWorkflowReviewVolumeCommand } from './review-volume.js'
import { registerWorkflowRewriteShowCommand } from './rewrite-show.js'
import { registerWorkflowWriteNextCommand } from './write-next.js'

export function registerWorkflowCommands(program: Command): void {
  // workflow 以 plan/write/review/draft/rewrite 五个域拆开，贴合章节生产链路的实际阶段。
  const planCommand = program.command('plan').description('Planning commands')
  const writeCommand = program.command('write').description('Writing commands')
  const reviewCommand = program.command('review').description('Review commands')
  const draftCommand = program.command('draft').description('Draft commands')
  const rewriteCommand = program.command('rewrite').description('Rewrite result commands')

  registerWorkflowPlanChapterCommand(planCommand)
  registerWorkflowPlanShowCommand(planCommand)
  registerWorkflowPlanMissionShowCommand(planCommand)
  registerWorkflowPlanVolumeWindowCommand(planCommand)
  registerWorkflowPlanVolumeShowCommand(planCommand)
  registerWorkflowWriteNextCommand(writeCommand)
  registerWorkflowDraftShowCommand(draftCommand)
  registerWorkflowReviewChapterCommand(reviewCommand)
  registerWorkflowReviewShowCommand(reviewCommand)
  registerWorkflowReviewVolumeCommand(reviewCommand)
  registerWorkflowRewriteShowCommand(rewriteCommand)
}
