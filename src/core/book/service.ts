import { z } from 'zod'

import type { Book, Outline } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import { NovelError } from '../../shared/utils/errors.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { OutlineRepository } from '../../infra/repository/outline-repository.js'

const initBookInputSchema = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  defaultChapterWordCount: z.number().int().positive().default(3000),
  chapterWordCountToleranceRatio: z.number().positive().max(1).default(0.15),
})

const setOutlineInputSchema = z.object({
  premise: z.string().min(1),
  theme: z.string().min(1),
  worldview: z.string().min(1),
  coreConflicts: z.array(z.string().min(1)).min(1),
  endingVision: z.string().min(1),
})

export type InitBookInput = z.input<typeof initBookInputSchema>
export type SetOutlineInput = z.input<typeof setOutlineInputSchema>

export class BookService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly outlineRepository: OutlineRepository,
  ) {}

  initializeBook(input: InitBookInput): Book {
    const parsed = initBookInputSchema.parse(input)
    const existingBook = this.bookRepository.getFirst()

    if (existingBook) {
      return existingBook
    }

    const timestamp = nowIso()
    const book: Book = {
      id: createId('book'),
      title: parsed.title,
      genre: parsed.genre,
      styleGuide: [],
      defaultChapterWordCount: parsed.defaultChapterWordCount,
      chapterWordCountToleranceRatio: parsed.chapterWordCountToleranceRatio,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.bookRepository.create(book)

    return book
  }

  async initializeBookAsync(input: InitBookInput): Promise<Book> {
    const parsed = initBookInputSchema.parse(input)
    const existingBook = await this.bookRepository.getFirstAsync()

    if (existingBook) {
      return existingBook
    }

    const timestamp = nowIso()
    const book: Book = {
      id: createId('book'),
      title: parsed.title,
      genre: parsed.genre,
      styleGuide: [],
      defaultChapterWordCount: parsed.defaultChapterWordCount,
      chapterWordCountToleranceRatio: parsed.chapterWordCountToleranceRatio,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.bookRepository.createAsync(book)

    return book
  }

  setOutline(input: SetOutlineInput): Outline {
    const parsed = setOutlineInputSchema.parse(input)
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const outline: Outline = {
      bookId: book.id,
      premise: parsed.premise,
      theme: parsed.theme,
      worldview: parsed.worldview,
      coreConflicts: parsed.coreConflicts,
      endingVision: parsed.endingVision,
      updatedAt: nowIso(),
    }

    this.outlineRepository.upsert(outline)

    return outline
  }

  async setOutlineAsync(input: SetOutlineInput): Promise<Outline> {
    const parsed = setOutlineInputSchema.parse(input)
    const book = await this.bookRepository.getFirstAsync()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const outline: Outline = {
      bookId: book.id,
      premise: parsed.premise,
      theme: parsed.theme,
      worldview: parsed.worldview,
      coreConflicts: parsed.coreConflicts,
      endingVision: parsed.endingVision,
      updatedAt: nowIso(),
    }

    await this.outlineRepository.upsertAsync(outline)

    return outline
  }
}
