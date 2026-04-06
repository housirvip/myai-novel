import type { LongTermMemory, ObservationMemory, ShortTermMemory } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ShortTermMemoryRow = {
  book_id: string
  chapter_id: string
  summaries_json: string
  recent_events_json: string
  updated_at: string
}

type ObservationMemoryRow = {
  book_id: string
  chapter_id: string
  entries_json: string
  updated_at: string
}

type LongTermMemoryRow = {
  book_id: string
  chapter_id: string
  entries_json: string
  updated_at: string
}

/**
 * `MemoryRepository` 维护三类“当前记忆快照”：
 * - short-term：近期摘要与事件窗口
 * - observation：暂时保留、尚未升级为长期事实的观察项
 * - long-term：高价值稳定事实
 *
 * 这些表都是 `*_current` 语义，不保留完整历史版本；
 * 若要追溯某次章节确认带来的变化，应查看 chapter memory updates。
 */
export class MemoryRepository {
  constructor(private readonly database: NovelDatabase) {}

  upsertShortTerm(memory: ShortTermMemory): void {
    dbRun(
      this.database,
      `
        INSERT INTO short_term_memory_current (
          book_id, chapter_id, summaries_json, recent_events_json, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          summaries_json = excluded.summaries_json,
          recent_events_json = excluded.recent_events_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.summaries),
      JSON.stringify(memory.recentEvents),
      memory.updatedAt,
    )
  }

  async upsertShortTermAsync(memory: ShortTermMemory): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO short_term_memory_current (
          book_id, chapter_id, summaries_json, recent_events_json, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          summaries_json = excluded.summaries_json,
          recent_events_json = excluded.recent_events_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.summaries),
      JSON.stringify(memory.recentEvents),
      memory.updatedAt,
    )
  }

  upsertObservation(memory: ObservationMemory): void {
    dbRun(
      this.database,
      `
        INSERT INTO observation_memory_current (
          book_id, chapter_id, entries_json, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          entries_json = excluded.entries_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.entries),
      memory.updatedAt,
    )
  }

  async upsertObservationAsync(memory: ObservationMemory): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO observation_memory_current (
          book_id, chapter_id, entries_json, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          entries_json = excluded.entries_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.entries),
      memory.updatedAt,
    )
  }

  upsertLongTerm(memory: LongTermMemory): void {
    dbRun(
      this.database,
      `
        INSERT INTO long_term_memory_current (
          book_id, chapter_id, entries_json, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          entries_json = excluded.entries_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.entries),
      memory.updatedAt,
    )
  }

  async upsertLongTermAsync(memory: LongTermMemory): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO long_term_memory_current (
          book_id, chapter_id, entries_json, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          entries_json = excluded.entries_json,
          updated_at = excluded.updated_at
      `,
      memory.bookId,
      memory.chapterId,
      JSON.stringify(memory.entries),
      memory.updatedAt,
    )
  }

  getShortTermByBookId(bookId: string): ShortTermMemory | null {
    const row = dbGet<ShortTermMemoryRow>(
      this.database,
      'SELECT * FROM short_term_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          summaries: JSON.parse(row.summaries_json) as string[],
          recentEvents: JSON.parse(row.recent_events_json) as string[],
          updatedAt: row.updated_at,
        }
      : null
  }

  async getShortTermByBookIdAsync(bookId: string): Promise<ShortTermMemory | null> {
    const row = await dbGetAsync<ShortTermMemoryRow>(
      this.database,
      'SELECT * FROM short_term_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          summaries: JSON.parse(row.summaries_json) as string[],
          recentEvents: JSON.parse(row.recent_events_json) as string[],
          updatedAt: row.updated_at,
        }
      : null
  }

  getObservationByBookId(bookId: string): ObservationMemory | null {
    const row = dbGet<ObservationMemoryRow>(
      this.database,
      'SELECT * FROM observation_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          entries: JSON.parse(row.entries_json) as ObservationMemory['entries'],
          updatedAt: row.updated_at,
        }
      : null
  }

  async getObservationByBookIdAsync(bookId: string): Promise<ObservationMemory | null> {
    const row = await dbGetAsync<ObservationMemoryRow>(
      this.database,
      'SELECT * FROM observation_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          entries: JSON.parse(row.entries_json) as ObservationMemory['entries'],
          updatedAt: row.updated_at,
        }
      : null
  }

  getLongTermByBookId(bookId: string): LongTermMemory | null {
    const row = dbGet<LongTermMemoryRow>(
      this.database,
      'SELECT * FROM long_term_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          entries: JSON.parse(row.entries_json) as LongTermMemory['entries'],
          updatedAt: row.updated_at,
        }
      : null
  }

  async getLongTermByBookIdAsync(bookId: string): Promise<LongTermMemory | null> {
    const row = await dbGetAsync<LongTermMemoryRow>(
      this.database,
      'SELECT * FROM long_term_memory_current WHERE book_id = ?',
      bookId,
    )

    return row
      ? {
          bookId: row.book_id,
          chapterId: row.chapter_id,
          entries: JSON.parse(row.entries_json) as LongTermMemory['entries'],
          updatedAt: row.updated_at,
        }
      : null
  }

  recallRelevantLongTermEntries(bookId: string, queryTerms: string[], maxEntries = 5): LongTermMemory['entries'] {
    const memory = this.getLongTermByBookId(bookId)

    if (!memory) {
      return []
    }

    const normalizedTerms = normalizeQueryTerms(queryTerms)

    // 这里的召回目标不是全文检索，而是给 planning / rewrite 提供少量高相关长期事实提示。
    return [...memory.entries]
      .map((entry) => ({
        entry,
        score: scoreLongTermEntry(entry, normalizedTerms),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, maxEntries)
      .map((item) => item.entry)
  }

  async recallRelevantLongTermEntriesAsync(
    bookId: string,
    queryTerms: string[],
    maxEntries = 5,
  ): Promise<LongTermMemory['entries']> {
    const memory = await this.getLongTermByBookIdAsync(bookId)

    if (!memory) {
      return []
    }

    const normalizedTerms = normalizeQueryTerms(queryTerms)

    // async 路径保持与同步路径相同的粗粒度相关性规则，避免后端切换后召回口径漂移。
    return [...memory.entries]
      .map((entry) => ({
        entry,
        score: scoreLongTermEntry(entry, normalizedTerms),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, maxEntries)
      .map((item) => item.entry)
  }
}

function normalizeQueryTerms(queryTerms: string[]): string[] {
  // 召回词会被压平成一组去重后的低噪声 term，
  // 这样章节标题、目标、planned beats 和物品名才能共用同一套匹配逻辑。
  return [...new Set(
    queryTerms
      .flatMap((term) => splitSearchTerms(term))
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length > 1),
  )]
}

function splitSearchTerms(term: string): string[] {
  const trimmed = term.trim()

  if (!trimmed) {
    return []
  }

  const compact = trimmed.replace(/\s+/g, ' ')
  const fragments = compact
    .split(/[，。；：、,.;:!?（）()【】\[\]<>《》“”"'\-\/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return [compact, ...fragments]
}

function scoreLongTermEntry(entry: LongTermMemory['entries'][number], queryTerms: string[]): number {
  const summary = entry.summary.toLowerCase()

  // importance 是长期记忆排序的基础分，term overlap 只是在同重要度下做相关性重排。
  return queryTerms.reduce((score, term) => {
    if (!term) {
      return score
    }

    if (summary === term) {
      return score + 12
    }

    if (summary.includes(term)) {
      return score + Math.min(8, Math.max(3, term.length))
    }

    const characters = [...term].filter((item) => /[\p{Script=Han}a-z0-9]/iu.test(item))
    const overlap = characters.filter((item) => summary.includes(item)).length

    if (characters.length >= 3 && overlap >= Math.ceil(characters.length * 0.6)) {
      return score + 2
    }

    return score
  }, entry.importance * 10)
}
