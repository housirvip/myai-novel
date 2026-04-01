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

    const chapterPlan = planningContext.chapter.currentPlanVersionId
      ? this.chapterPlanRepository.getByVersionId(chapterId, planningContext.chapter.currentPlanVersionId)
      : this.chapterPlanRepository.getLatestByChapterId(chapterId)

    if (!chapterPlan) {
      throw new NovelError('Chapter plan is required before writing. Run `novel plan chapter <id>`.')
    }

    return {
      ...planningContext,
      chapterPlan,
    }
  }
}
