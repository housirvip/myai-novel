import path from 'node:path'
import { writeFile } from 'node:fs/promises'

import type { ApproveResult, ChapterOutput, ChapterRewrite, StoryState } from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import {
  buildCompletedChapterFilename,
  resolveProjectPaths,
} from '../../shared/utils/project-paths.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { MemoryRepository } from '../../infra/repository/memory-repository.js'
import type { StoryStateRepository } from '../../infra/repository/story-state-repository.js'

type DraftSource =
  | { sourceType: 'rewrite'; sourceId: string; versionId: string; content: string }
  | { sourceType: 'draft'; sourceId: string; versionId: string; content: string }

export class ApproveService {
  constructor(
    private readonly rootDir: string,
    private readonly bookRepository: BookRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterRewriteRepository: ChapterRewriteRepository,
    private readonly chapterOutputRepository: ChapterOutputRepository,
    private readonly storyStateRepository: StoryStateRepository,
    private readonly hookRepository: HookRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly memoryRepository: MemoryRepository,
  ) {}

  async approveChapter(chapterId: string): Promise<ApproveResult> {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const chapter = this.chapterRepository.getById(chapterId)

    if (!chapter) {
      throw new NovelError(`Chapter not found: ${chapterId}`)
    }

    if (chapter.status !== 'reviewed') {
      throw new NovelError('Only reviewed chapters can be approved.')
    }

    const source = this.resolveSource(chapterId)
    const approvedAt = nowIso()
    const projectPaths = resolveProjectPaths(this.rootDir)
    const finalFilename = buildCompletedChapterFilename(chapter.index, chapter.title)
    const finalPath = path.join(projectPaths.completedChaptersDir, finalFilename)

    await writeFile(finalPath, `${source.content}\n`, 'utf8')

    const output: ChapterOutput = {
      id: createId('output'),
      bookId: book.id,
      chapterId,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      finalPath,
      content: source.content,
      createdAt: approvedAt,
    }

    const state: StoryState = {
      bookId: book.id,
      currentChapterId: chapterId,
      recentEvents: [`第 ${chapter.index} 章《${chapter.title}》已确认终稿`],
      updatedAt: approvedAt,
    }

    this.chapterOutputRepository.create(output)
    this.storyStateRepository.upsert(state)
    this.updateHookStates(book.id, approvedAt)
    this.memoryRepository.upsertShortTerm({
      bookId: book.id,
      chapterId,
      summaries: [`第 ${chapter.index} 章《${chapter.title}》终稿已确认`],
      recentEvents: state.recentEvents,
      updatedAt: approvedAt,
    })
    this.memoryRepository.upsertLongTerm({
      bookId: book.id,
      chapterId,
      entries: [
        {
          summary: `第 ${chapter.index} 章《${chapter.title}》已成为当前主线正式内容`,
          importance: 4,
        },
      ],
      updatedAt: approvedAt,
    })
    this.chapterRepository.finalizeChapter(chapterId, source.versionId, finalPath, approvedAt)

    return {
      chapterId,
      chapterStatus: 'finalized',
      versionId: source.versionId,
      finalPath,
      stateUpdated: true,
      memoryUpdated: true,
      hooksUpdated: true,
      approvedAt,
    }
  }

  private updateHookStates(bookId: string, updatedAt: string): void {
    const hooks = this.hookRepository.listByBookId(bookId)

    for (const hook of hooks) {
      this.hookStateRepository.upsert({
        bookId,
        hookId: hook.id,
        status: hook.status,
        updatedAt,
      })
    }
  }

  private resolveSource(chapterId: string): DraftSource {
    const rewrite = this.chapterRewriteRepository.getLatestByChapterId(chapterId)

    if (rewrite) {
      return mapRewriteSource(rewrite)
    }

    const draft = this.chapterDraftRepository.getLatestByChapterId(chapterId)

    if (!draft) {
      throw new NovelError('No draft or rewrite candidate found for approval.')
    }

    return {
      sourceType: 'draft',
      sourceId: draft.id,
      versionId: draft.versionId,
      content: draft.content,
    }
  }
}

function mapRewriteSource(rewrite: ChapterRewrite): DraftSource {
  return {
    sourceType: 'rewrite',
    sourceId: rewrite.id,
    versionId: rewrite.versionId,
    content: rewrite.content,
  }
}
