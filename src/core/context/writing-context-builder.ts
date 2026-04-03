import type { WritingContext } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import type { PlanningContextBuilder } from './planning-context-builder.js'

export class WritingContextBuilder {
  constructor(
    private readonly planningContextBuilder: PlanningContextBuilder,
    private readonly chapterPlanRepository: ChapterPlanRepository,
  ) {}

  build(chapterId: string): WritingContext {
    const planningContext = this.planningContextBuilder.build(chapterId)

    if (!planningContext.chapter.currentPlanVersionId) {
      throw new NovelError('Current chapter plan is missing. Run `novel plan chapter <id>`.')
    }

    const chapterPlan = this.chapterPlanRepository.getByVersionId(
      chapterId,
      planningContext.chapter.currentPlanVersionId,
    )

    if (!chapterPlan) {
      throw new NovelError('Current chapter plan is missing. Run `novel plan chapter <id>`.')
    }

    return {
      ...planningContext,
      chapterPlan,
    }
  }
}
