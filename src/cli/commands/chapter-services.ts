import { ApproveService } from '../../core/approve/service.js'
import { ChapterDropService } from '../../core/chapter-drop/service.js'
import { RewriteService } from '../../core/rewrite/service.js'
import { WorldService } from '../../core/world/service.js'
import type { NovelDatabase } from '../../infra/db/database.js'
import { createLlmAdapter } from '../../infra/llm/factory.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterArcRepository } from '../../infra/repository/character-arc-repository.js'
import { ChapterContradictionRepository } from '../../infra/repository/chapter-contradiction-repository.js'
import { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import { CharacterRepository } from '../../infra/repository/character-repository.js'
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
import { EndingReadinessRepository } from '../../infra/repository/ending-readiness-repository.js'
import { FactionRepository } from '../../infra/repository/faction-repository.js'
import { HookPressureRepository } from '../../infra/repository/hook-pressure-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../infra/repository/item-repository.js'
import { LocationRepository } from '../../infra/repository/location-repository.js'
import { MemoryRepository } from '../../infra/repository/memory-repository.js'
import { NarrativeDebtRepository } from '../../infra/repository/narrative-debt-repository.js'
import { StoryStateRepository } from '../../infra/repository/story-state-repository.js'
import { StoryThreadProgressRepository } from '../../infra/repository/story-thread-progress-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'

/**
 * `chapter` 命令域的服务装配层。
 *
 * 这里集中承载 repository / service 的实例化逻辑，
 * 让命令注册文件只保留参数定义与结果输出，减少重复装配噪音。
 */
export function createChapterWorldService(database: NovelDatabase): WorldService {
  return new WorldService(
    new BookRepository(database),
    new VolumeRepository(database),
    new ChapterRepository(database),
    new CharacterRepository(database),
    new LocationRepository(database),
    new FactionRepository(database),
    new HookRepository(database),
    new ItemRepository(database),
    new ItemCurrentStateRepository(database),
  )
}

export function createChapterRewriteService(database: NovelDatabase): RewriteService {
  return new RewriteService(
    new BookRepository(database),
    new ChapterRepository(database),
    new ChapterDraftRepository(database),
    new ChapterPlanRepository(database),
    new ChapterReviewRepository(database),
    new ChapterRewriteRepository(database),
    new CharacterCurrentStateRepository(database),
    new ItemCurrentStateRepository(database),
    new HookStateRepository(database),
    new MemoryRepository(database),
    createLlmAdapter(),
  )
}

export function createChapterApproveService(database: NovelDatabase, rootDir: string): ApproveService {
  return new ApproveService(
    rootDir,
    new BookRepository(database),
    new ChapterRepository(database),
    new ChapterDraftRepository(database),
    new ChapterRewriteRepository(database),
    new ChapterPlanRepository(database),
    new ChapterReviewRepository(database),
    new ChapterOutcomeRepository(database),
    new NarrativeDebtRepository(database),
    new ChapterContradictionRepository(database),
    new ChapterOutputRepository(database),
    new ChapterStateUpdateRepository(database),
    new ChapterMemoryUpdateRepository(database),
    new ChapterHookUpdateRepository(database),
    new StoryStateRepository(database),
    new StoryThreadProgressRepository(database),
    new EndingReadinessRepository(database),
    new CharacterRepository(database),
    new CharacterCurrentStateRepository(database),
    new CharacterArcRepository(database),
    new HookRepository(database),
    new HookStateRepository(database),
    new HookPressureRepository(database),
    new ItemRepository(database),
    new ItemCurrentStateRepository(database),
    new MemoryRepository(database),
  )
}

export function createChapterDropService(database: NovelDatabase): ChapterDropService {
  return new ChapterDropService(
    new ChapterRepository(database),
    new ChapterPlanRepository(database),
    new ChapterDraftRepository(database),
    new ChapterReviewRepository(database),
    new ChapterRewriteRepository(database),
    new ChapterOutputRepository(database),
  )
}
