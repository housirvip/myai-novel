import type { StoryThread } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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

export class StoryThreadRepository {
  constructor(private readonly database: NovelDatabase) {}

  createBatch(threads: StoryThread[]): void {
    const statement = this.database.prepare(
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
      `,
    )

    for (const thread of threads) {
      statement.run(
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
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM story_threads
          WHERE book_id = ? AND status = 'active'
          ORDER BY updated_at DESC, priority DESC
        `,
      )
      .all(bookId) as StoryThreadRow[]

    return rows.map(mapStoryThread)
  }

  listByVolumeId(volumeId: string): StoryThread[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM story_threads
          WHERE volume_id = ?
          ORDER BY updated_at DESC, priority DESC
        `,
      )
      .all(volumeId) as StoryThreadRow[]

    return rows.map(mapStoryThread)
  }

  upsert(thread: StoryThread): void {
    this.database
      .prepare(
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
      )
      .run(
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
