import path from 'node:path'
import { writeFile } from 'node:fs/promises'

import type {
  ApproveResult,
  ChapterHookUpdate,
  ChapterMemoryUpdate,
  ChapterOutput,
  ChapterRewrite,
  ChapterStateUpdate,
  CharacterCurrentState,
  ItemCurrentState,
  StoryState,
} from '../../shared/types/domain.js'
import { NovelError } from '../../shared/utils/errors.js'
import { createId } from '../../shared/utils/id.js'
import {
  buildCompletedChapterFilename,
  resolveProjectPaths,
} from '../../shared/utils/project-paths.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterRepository } from '../../infra/repository/character-repository.js'
import type { CharacterCurrentStateRepository } from '../../infra/repository/character-current-state-repository.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterHookUpdateRepository } from '../../infra/repository/chapter-hook-update-repository.js'
import type { ChapterMemoryUpdateRepository } from '../../infra/repository/chapter-memory-update-repository.js'
import type { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import type { ChapterStateUpdateRepository } from '../../infra/repository/chapter-state-update-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { HookStateRepository } from '../../infra/repository/hook-state-repository.js'
import type { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import type { ItemRepository } from '../../infra/repository/item-repository.js'
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
    private readonly chapterStateUpdateRepository: ChapterStateUpdateRepository,
    private readonly chapterMemoryUpdateRepository: ChapterMemoryUpdateRepository,
    private readonly chapterHookUpdateRepository: ChapterHookUpdateRepository,
    private readonly storyStateRepository: StoryStateRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly characterCurrentStateRepository: CharacterCurrentStateRepository,
    private readonly hookRepository: HookRepository,
    private readonly hookStateRepository: HookStateRepository,
    private readonly itemRepository: ItemRepository,
    private readonly itemCurrentStateRepository: ItemCurrentStateRepository,
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
    const hookUpdates = this.updateHookStates(book.id, chapterId, approvedAt)
    const stateUpdates = [
      ...this.updateCharacterState(book.id, chapterId, source.content, approvedAt),
      ...this.updateItemStates(book.id, chapterId, source.content, approvedAt),
    ]
    const previousShortTerm = this.memoryRepository.getShortTermByBookId(book.id)
    const previousLongTerm = this.memoryRepository.getLongTermByBookId(book.id)
    const nextShortTermSummaries = mergeRecentStrings(previousShortTerm?.summaries ?? [], [`第 ${chapter.index} 章《${chapter.title}》终稿已确认`], 3)
    const nextShortTermEvents = mergeRecentStrings(previousShortTerm?.recentEvents ?? [], state.recentEvents, 5)
    const nextLongTermEntries = mergeLongTermEntries(previousLongTerm?.entries ?? [], [
      {
        summary: `第 ${chapter.index} 章《${chapter.title}》已成为当前主线正式内容`,
        importance: 4,
        sourceChapterId: chapterId,
      },
    ])
    this.memoryRepository.upsertShortTerm({
      bookId: book.id,
      chapterId,
      summaries: nextShortTermSummaries,
      recentEvents: nextShortTermEvents,
      updatedAt: approvedAt,
    })
    this.memoryRepository.upsertLongTerm({
      bookId: book.id,
      chapterId,
      entries: nextLongTermEntries,
      updatedAt: approvedAt,
    })
    const memoryUpdates = this.buildMemoryUpdates(book.id, chapterId, approvedAt, nextShortTermSummaries, nextShortTermEvents, nextLongTermEntries)
    this.persistUpdateLogs(stateUpdates, memoryUpdates, hookUpdates)
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

  private updateHookStates(bookId: string, chapterId: string, updatedAt: string): ChapterHookUpdate[] {
    const hooks = this.hookRepository.listByBookId(bookId)
    const updates: ChapterHookUpdate[] = []

    for (const hook of hooks) {
      this.hookStateRepository.upsert({
        bookId,
        hookId: hook.id,
        status: hook.status,
        updatedByChapterId: chapterId,
        updatedAt,
      })

      updates.push({
        id: createId('hook_update'),
        bookId,
        chapterId,
        hookId: hook.id,
        status: hook.status,
        summary: `Hook ${hook.title} 当前状态为 ${hook.status}`,
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private updateCharacterState(bookId: string, chapterId: string, content: string, updatedAt: string): ChapterStateUpdate[] {
    const protagonist = this.characterRepository.getPrimaryByBookId(bookId)

    if (!protagonist) {
      return []
    }

    const explicitLocation = content.match(/地点[：: ]+([^\n]+)/)?.[1]?.trim()
    const currentLocationId = explicitLocation?.startsWith('location_') ? explicitLocation : undefined

    const state: CharacterCurrentState = {
      bookId,
      characterId: protagonist.id,
      currentLocationId,
      statusNotes: explicitLocation
        ? [`章节确认后记录的位置线索：${explicitLocation}`]
        : ['章节确认后写入的最小角色位置状态'],
      updatedAt,
    }

    this.characterCurrentStateRepository.upsert(state)

    return [
      {
        id: createId('state_update'),
        bookId,
        chapterId,
        entityType: 'character',
        entityId: protagonist.id,
        summary: state.statusNotes[0] ?? '角色状态已更新',
        createdAt: updatedAt,
      },
    ]
  }

  private updateItemStates(bookId: string, chapterId: string, content: string, updatedAt: string): ChapterStateUpdate[] {
    const items = this.itemRepository.listByBookId(bookId)
    const updates: ChapterStateUpdate[] = []

    for (const item of items) {
      if (!item.isImportant || (!content.includes(item.name) && !content.includes(item.id))) {
        continue
      }

      const previousState = this.itemCurrentStateRepository.getByItemId(bookId, item.id)
      const quantityMatch = content.match(new RegExp(`${escapeRegExp(item.name)}（${escapeRegExp(item.id)}）[：:]?[^\n]*数量=(\\d+)`))
      const statusMatch = content.match(new RegExp(`${escapeRegExp(item.name)}（${escapeRegExp(item.id)}）[：:]?[^\n]*状态=([^；\n]+)`))
      const ownerMatch = content.match(new RegExp(`${escapeRegExp(item.name)}（${escapeRegExp(item.id)}）[：:]?[^\n]*持有者=([^；\n]+)`))
      const locationMatch = content.match(new RegExp(`${escapeRegExp(item.name)}（${escapeRegExp(item.id)}）[：:]?[^\n]*地点=([^；\n]+)`))
      const nextOwnerCharacterId = ownerMatch?.[1]?.trim()?.startsWith('character_') ? ownerMatch[1].trim() : previousState?.ownerCharacterId
      const nextLocationId = locationMatch?.[1]?.trim()?.startsWith('location_') ? locationMatch[1].trim() : previousState?.locationId
      const nextState: ItemCurrentState = {
        bookId,
        itemId: item.id,
        ownerCharacterId: nextOwnerCharacterId,
        locationId: nextLocationId,
        quantity: quantityMatch ? Number.parseInt(quantityMatch[1], 10) : (previousState?.quantity ?? 1),
        status: statusMatch?.[1]?.trim() ?? previousState?.status ?? '已在终稿中承接',
        updatedAt,
      }

      this.itemCurrentStateRepository.upsert(nextState)

      updates.push({
        id: createId('state_update'),
        bookId,
        chapterId,
        entityType: 'item',
        entityId: item.id,
        summary: `物品 ${item.name} 更新为 数量=${nextState.quantity}，状态=${nextState.status}`,
        createdAt: updatedAt,
      })
    }

    return updates
  }

  private buildMemoryUpdates(
    bookId: string,
    chapterId: string,
    createdAt: string,
    shortTermSummaries: string[],
    shortTermEvents: string[],
    longTermEntries: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
  ): ChapterMemoryUpdate[] {
    return [
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'short-term',
        summary: `短期记忆已更新：${shortTermSummaries.at(-1) ?? shortTermEvents.at(-1) ?? '最近事件窗口已刷新'}`,
        createdAt,
      },
      {
        id: createId('memory_update'),
        bookId,
        chapterId,
        memoryType: 'long-term',
        summary: `长期记忆已更新：${longTermEntries[0]?.summary ?? '高重要事实集合已刷新'}`,
        createdAt,
      },
    ]
  }

  private persistUpdateLogs(
    stateUpdates: ChapterStateUpdate[],
    memoryUpdates: ChapterMemoryUpdate[],
    hookUpdates: ChapterHookUpdate[],
  ): void {
    for (const update of stateUpdates) {
      this.chapterStateUpdateRepository.create(update)
    }

    for (const update of memoryUpdates) {
      this.chapterMemoryUpdateRepository.create(update)
    }

    for (const update of hookUpdates) {
      this.chapterHookUpdateRepository.create(update)
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mergeRecentStrings(previous: string[], next: string[], limit: number): string[] {
  return [...new Set([...previous, ...next])].slice(-limit)
}

function mergeLongTermEntries(
  previous: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
  next: Array<{ summary: string; importance: number; sourceChapterId?: string }>,
): Array<{ summary: string; importance: number; sourceChapterId?: string }> {
  const merged = new Map<string, { summary: string; importance: number; sourceChapterId?: string }>()

  for (const entry of [...previous, ...next]) {
    const existing = merged.get(entry.summary)

    if (!existing || existing.importance <= entry.importance) {
      merged.set(entry.summary, entry)
    }
  }

  return [...merged.values()].sort((left, right) => right.importance - left.importance).slice(0, 10)
}
