import { PlanningContextBuilder } from '../../core/context/planning-context-builder.js'
import { WritingContextBuilder } from '../../core/context/writing-context-builder.js'
import { GenerationService } from '../../core/generation/service.js'
import { PlanningService } from '../../core/planning/service.js'
import { ReviewService } from '../../core/review/service.js'
import type { NovelDatabase } from '../../infra/db/database.js'
import { createLlmAdapter } from '../../infra/llm/factory.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
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

/**
 * `workflow` 命令域的装配层。
 *
 * 这里集中创建 planning / writing / review 相关 service，
 * 让命令定义文件只负责 commander 注册、参数解析和结果输出。
 */
export function createWorkflowPlanningContextBuilder(database: NovelDatabase): PlanningContextBuilder {
  return new PlanningContextBuilder(
    new BookRepository(database),
    new OutlineRepository(database),
    new ChapterRepository(database),
    new VolumeRepository(database),
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
}

export function createWorkflowPlanningService(database: NovelDatabase): PlanningService {
  return new PlanningService(
    createWorkflowPlanningContextBuilder(database),
    new ChapterPlanRepository(database),
    new ChapterRepository(database),
    createLlmAdapter(),
    new HookRepository(database),
  )
}

export function createWorkflowWritingContextBuilder(database: NovelDatabase): WritingContextBuilder {
  return new WritingContextBuilder(
    createWorkflowPlanningContextBuilder(database),
    new ChapterPlanRepository(database),
  )
}

export function createWorkflowGenerationService(database: NovelDatabase): GenerationService {
  return new GenerationService(
    createWorkflowWritingContextBuilder(database),
    new ChapterDraftRepository(database),
    new ChapterRepository(database),
    createLlmAdapter(),
  )
}

export function createWorkflowReviewService(database: NovelDatabase): ReviewService {
  return new ReviewService(
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
}
