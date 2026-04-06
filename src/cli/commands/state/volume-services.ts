import type { NovelDatabase } from '../../../infra/db/database.js'
import { BookRepository } from '../../../infra/repository/book-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { EndingReadinessRepository } from '../../../infra/repository/ending-readiness-repository.js'
import { StoryThreadRepository } from '../../../infra/repository/story-thread-repository.js'
import { VolumePlanRepository } from '../../../infra/repository/volume-plan-repository.js'
import { VolumeRepository } from '../../../infra/repository/volume-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'

/**
 * `state volume` 命令域的查询装配层。
 *
 * 这里把某一卷当前最重要的长期状态真源汇总到一起：
 * - 卷本身与章节列表
 * - 最新卷计划
 * - 当前故事线程
 * - 终局准备快照
 *
 * 它是一个状态视图函数，不负责生成或修改这些对象。
 */
export function loadStateVolumeView(database: NovelDatabase, volumeId: string): {
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
  }>
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
} {
  const book = new BookRepository(database).getFirst()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = new VolumeRepository(database).getById(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapters = new ChapterRepository(database)
    .listByBookId(book.id)
    .filter((chapter) => chapter.volumeId === volumeId)
    .map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
    }))

  return {
    book,
    volume,
    chapters,
    latestVolumePlan: new VolumePlanRepository(database).getLatestByVolumeId(volumeId),
    storyThreads: new StoryThreadRepository(database).listByVolumeId(volumeId),
    endingReadiness: new EndingReadinessRepository(database).getByBookId(book.id),
  }
}

/**
 * 异步版卷状态聚合视图。
 */
export async function loadStateVolumeViewAsync(database: NovelDatabase, volumeId: string): Promise<{
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
  }>
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
}> {
  const book = await new BookRepository(database).getFirstAsync()

  if (!book) {
    throw new NovelError('Project is not initialized. Run `novel init` first.')
  }

  const volume = await new VolumeRepository(database).getByIdAsync(volumeId)

  if (!volume) {
    throw new NovelError(`Volume not found: ${volumeId}`)
  }

  const chapters = (await new ChapterRepository(database)
    .listByBookIdAsync(book.id))
    .filter((chapter) => chapter.volumeId === volumeId)
    .map((chapter) => ({
      id: chapter.id,
      index: chapter.index,
      title: chapter.title,
      status: chapter.status,
    }))

  return {
    book,
    volume,
    chapters,
    latestVolumePlan: await new VolumePlanRepository(database).getLatestByVolumeIdAsync(volumeId),
    storyThreads: await new StoryThreadRepository(database).listByVolumeIdAsync(volumeId),
    endingReadiness: await new EndingReadinessRepository(database).getByBookIdAsync(book.id),
  }
}
