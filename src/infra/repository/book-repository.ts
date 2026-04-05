import type { Book } from '../../shared/types/domain.js'
import { readLlmEnv } from '../../shared/utils/env.js'
import type { NovelDatabase } from '../db/database.js'
import { dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type BookRow = {
  id: string
  title: string
  genre: string
  style_guide_json: string
  default_chapter_word_count: number
  chapter_word_count_tolerance_ratio: number
  model_provider: string
  model_name: string
  model_temperature: number | null
  model_max_tokens: number | null
  created_at: string
  updated_at: string
}

export class BookRepository {
  constructor(private readonly database: NovelDatabase) {}

  getFirst(): Book | null {
    const row = dbGet<BookRow>(this.database, 'SELECT * FROM books ORDER BY created_at ASC LIMIT 1')

    return row ? mapBook(row) : null
  }

  async getFirstAsync(): Promise<Book | null> {
    const row = await dbGetAsync<BookRow>(this.database, 'SELECT * FROM books ORDER BY created_at ASC LIMIT 1')

    return row ? mapBook(row) : null
  }

  getById(id: string): Book | null {
    const row = dbGet<BookRow>(this.database, 'SELECT * FROM books WHERE id = ?', id)

    return row ? mapBook(row) : null
  }

  async getByIdAsync(id: string): Promise<Book | null> {
    const row = await dbGetAsync<BookRow>(this.database, 'SELECT * FROM books WHERE id = ?', id)

    return row ? mapBook(row) : null
  }

  create(book: Book): void {
    const env = readLlmEnv()

    dbRun(
      this.database,
      `
        INSERT INTO books (
          id,
          title,
          genre,
          style_guide_json,
          default_chapter_word_count,
          chapter_word_count_tolerance_ratio,
          model_provider,
          model_name,
          model_temperature,
          model_max_tokens,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      book.id,
      book.title,
      book.genre,
      JSON.stringify(book.styleGuide),
      book.defaultChapterWordCount,
      book.chapterWordCountToleranceRatio,
      env.provider,
      env.defaultModel,
      null,
      null,
      book.createdAt,
      book.updatedAt,
    )
  }

  async createAsync(book: Book): Promise<void> {
    const env = readLlmEnv()

    await dbRunAsync(
      this.database,
      `
        INSERT INTO books (
          id,
          title,
          genre,
          style_guide_json,
          default_chapter_word_count,
          chapter_word_count_tolerance_ratio,
          model_provider,
          model_name,
          model_temperature,
          model_max_tokens,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      book.id,
      book.title,
      book.genre,
      JSON.stringify(book.styleGuide),
      book.defaultChapterWordCount,
      book.chapterWordCountToleranceRatio,
      env.provider,
      env.defaultModel,
      null,
      null,
      book.createdAt,
      book.updatedAt,
    )
  }
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre,
    styleGuide: JSON.parse(row.style_guide_json) as string[],
    defaultChapterWordCount: row.default_chapter_word_count,
    chapterWordCountToleranceRatio: row.chapter_word_count_tolerance_ratio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
