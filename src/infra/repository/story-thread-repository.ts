import type { StoryThread } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type StoryThreadRow = {
  id: string
  book_id: string
  volume_id: string
  title: string
  thread_type: StoryThread['threadType']
  summary: string
  priority: StoryThread['priority']
  stage: StoryThread['stage']
  linked_character_ids_json: string
  linked_hook_ids_json: string
  target_outcome: string
  status: StoryThread['status']
  updated_by_chapter_id: string | null
  updated_at: string
}

/**
 * `StoryThreadRepository` 保存故事线程的当前定义与当前状态。
 *
 * 它和 `StoryThreadProgressRepository` 的区别是：
 * - 这里表示“线程现在是什么、处于哪个阶段、是否仍 active”
 * - progress repository 表示“线程在某一章里发生了什么推进”
 */
export class StoryThreadRepository {
  constructor(private readonly database: NovelDatabase) {}

  createBatch(threads: StoryThread[]): void {
    const insertSql = `
      INSERT INTO story_threads (
        id,
        book_id,
        volume_id,
        title,
        thread_type,
        summary,
        priority,
        stage,
        linked_character_ids_json,
        linked_hook_ids_json,
        target_outcome,
        status,
        updated_by_chapter_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    // 初始化 volume / outcome 派生线程时通常是小批量写入，这里优先保持逻辑直白。
    for (const thread of threads) {
      dbRun(
        this.database,
        insertSql,
        thread.id,
        thread.bookId,
        thread.volumeId,
        thread.title,
        thread.threadType,
        thread.summary,
        thread.priority,
        thread.stage,
        JSON.stringify(thread.linkedCharacterIds),
        JSON.stringify(thread.linkedHookIds),
        thread.targetOutcome,
        thread.status,
        thread.updatedByChapterId ?? null,
        thread.updatedAt,
      )
    }
  }

  async createBatchAsync(threads: StoryThread[]): Promise<void> {
    const insertSql = `
      INSERT INTO story_threads (
        id,
        book_id,
        volume_id,
        title,
        thread_type,
        summary,
        priority,
        stage,
        linked_character_ids_json,
        linked_hook_ids_json,
        target_outcome,
        status,
        updated_by_chapter_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    for (const thread of threads) {
      await dbRunAsync(
        this.database,
        insertSql,
        thread.id,
        thread.bookId,
        thread.volumeId,
        thread.title,
        thread.threadType,
        thread.summary,
        thread.priority,
        thread.stage,
        JSON.stringify(thread.linkedCharacterIds),
        JSON.stringify(thread.linkedHookIds),
        thread.targetOutcome,
        thread.status,
        thread.updatedByChapterId ?? null,
        thread.updatedAt,
      )
    }
  }

  listActiveByBookId(bookId: string): StoryThread[] {
    // active 线程会直接进入 planning / doctor / state 视图，因此单独提供高频查询。
    const rows = dbAll<StoryThreadRow>(
      this.database,
      `
        SELECT *
        FROM story_threads
        WHERE book_id = ? AND status = 'active'
        ORDER BY updated_at DESC, priority DESC
      `,
      bookId,
    )

    return rows.map(mapStoryThread)
  }

  async listActiveByBookIdAsync(bookId: string): Promise<StoryThread[]> {
    const rows = await dbAllAsync<StoryThreadRow>(
      this.database,
      `
        SELECT *
        FROM story_threads
        WHERE book_id = ? AND status = 'active'
        ORDER BY updated_at DESC, priority DESC
      `,
      bookId,
    )

    return rows.map(mapStoryThread)
  }

  listByVolumeId(volumeId: string): StoryThread[] {
    const rows = dbAll<StoryThreadRow>(
      this.database,
      `
        SELECT *
        FROM story_threads
        WHERE volume_id = ?
        ORDER BY updated_at DESC, priority DESC
      `,
      volumeId,
    )

    return rows.map(mapStoryThread)
  }

  async listByVolumeIdAsync(volumeId: string): Promise<StoryThread[]> {
    const rows = await dbAllAsync<StoryThreadRow>(
      this.database,
      `
        SELECT *
        FROM story_threads
        WHERE volume_id = ?
        ORDER BY updated_at DESC, priority DESC
      `,
      volumeId,
    )

    return rows.map(mapStoryThread)
  }

  upsert(thread: StoryThread): void {
    // thread 以 id 为身份锚点持续演化，而不是按章节不断新增新行。
    dbRun(
      this.database,
      `
        INSERT INTO story_threads (
          id,
          book_id,
          volume_id,
          title,
          thread_type,
          summary,
          priority,
          stage,
          linked_character_ids_json,
          linked_hook_ids_json,
          target_outcome,
          status,
          updated_by_chapter_id,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          title = excluded.title,
          thread_type = excluded.thread_type,
          summary = excluded.summary,
          priority = excluded.priority,
          stage = excluded.stage,
          linked_character_ids_json = excluded.linked_character_ids_json,
          linked_hook_ids_json = excluded.linked_hook_ids_json,
          target_outcome = excluded.target_outcome,
          status = excluded.status,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          updated_at = excluded.updated_at
      `,
      thread.id,
      thread.bookId,
      thread.volumeId,
      thread.title,
      thread.threadType,
      thread.summary,
      thread.priority,
      thread.stage,
      JSON.stringify(thread.linkedCharacterIds),
      JSON.stringify(thread.linkedHookIds),
      thread.targetOutcome,
      thread.status,
      thread.updatedByChapterId ?? null,
      thread.updatedAt,
    )
  }

  async upsertAsync(thread: StoryThread): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO story_threads (
          id,
          book_id,
          volume_id,
          title,
          thread_type,
          summary,
          priority,
          stage,
          linked_character_ids_json,
          linked_hook_ids_json,
          target_outcome,
          status,
          updated_by_chapter_id,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          title = excluded.title,
          thread_type = excluded.thread_type,
          summary = excluded.summary,
          priority = excluded.priority,
          stage = excluded.stage,
          linked_character_ids_json = excluded.linked_character_ids_json,
          linked_hook_ids_json = excluded.linked_hook_ids_json,
          target_outcome = excluded.target_outcome,
          status = excluded.status,
          updated_by_chapter_id = excluded.updated_by_chapter_id,
          updated_at = excluded.updated_at
      `,
      thread.id,
      thread.bookId,
      thread.volumeId,
      thread.title,
      thread.threadType,
      thread.summary,
      thread.priority,
      thread.stage,
      JSON.stringify(thread.linkedCharacterIds),
      JSON.stringify(thread.linkedHookIds),
      thread.targetOutcome,
      thread.status,
      thread.updatedByChapterId ?? null,
      thread.updatedAt,
    )
  }
}

function mapStoryThread(row: StoryThreadRow): StoryThread {
  // linked characters / hooks 是线程与其他真源的轻绑定关系，因此统一以 JSON 形式存取。
  return {
    id: row.id,
    bookId: row.book_id,
    volumeId: row.volume_id,
    title: row.title,
    threadType: row.thread_type,
    summary: row.summary,
    priority: row.priority,
    stage: row.stage,
    linkedCharacterIds: JSON.parse(row.linked_character_ids_json) as string[],
    linkedHookIds: JSON.parse(row.linked_hook_ids_json) as string[],
    targetOutcome: row.target_outcome,
    status: row.status,
    updatedByChapterId: row.updated_by_chapter_id ?? undefined,
    updatedAt: row.updated_at,
  }
}
