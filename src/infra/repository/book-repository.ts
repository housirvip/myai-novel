import type { Book } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

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
    const row = this.database.prepare('SELECT * FROM books ORDER BY created_at ASC LIMIT 1').get() as
      | BookRow
      | undefined

    return row ? mapBook(row) : null
  }

  create(book: Book): void {
    this.database
      .prepare(
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
      )
      .run(
        book.id,
        book.title,
        book.genre,
        JSON.stringify(book.styleGuide),
        book.defaultChapterWordCount,
        book.chapterWordCountToleranceRatio,
        book.model.provider,
        book.model.modelName,
        book.model.temperature ?? null,
        book.model.maxTokens ?? null,
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
    model: {
      provider: row.model_provider,
      modelName: row.model_name,
      temperature: row.model_temperature ?? undefined,
      maxTokens: row.model_max_tokens ?? undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
