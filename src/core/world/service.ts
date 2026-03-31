import { z } from 'zod'

import type { Chapter, Volume } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { NovelError } from '../../shared/utils/errors.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { VolumeRepository } from '../../infra/repository/volume-repository.js'

const addVolumeInputSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
  summary: z.string().min(1),
})

const addChapterInputSchema = z.object({
  volumeId: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  plannedBeats: z.array(z.string().min(1)).default([]),
  index: z.number().int().positive().optional(),
})

export type AddVolumeInput = z.input<typeof addVolumeInputSchema>
export type AddChapterInput = z.input<typeof addChapterInputSchema>

export class WorldService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly volumeRepository: VolumeRepository,
    private readonly chapterRepository: ChapterRepository,
  ) {}

  addVolume(input: AddVolumeInput): Volume {
    const parsed = addVolumeInputSchema.parse(input)
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const timestamp = nowIso()
    const volume: Volume = {
      id: createId('volume'),
      bookId: book.id,
      title: parsed.title,
      goal: parsed.goal,
      summary: parsed.summary,
      chapterIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.volumeRepository.create(volume)

    return volume
  }

  addChapter(input: AddChapterInput): Chapter {
    const parsed = addChapterInputSchema.parse(input)
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    const volume = this.volumeRepository.getById(parsed.volumeId)

    if (!volume) {
      throw new NovelError(`Volume not found: ${parsed.volumeId}`)
    }

    if (volume.bookId !== book.id) {
      throw new NovelError('Volume does not belong to the current book.')
    }

    const timestamp = nowIso()
    const chapter: Chapter = {
      id: createId('chapter'),
      bookId: book.id,
      volumeId: parsed.volumeId,
      index: parsed.index ?? this.chapterRepository.getNextIndex(book.id),
      title: parsed.title,
      objective: parsed.objective,
      plannedBeats: parsed.plannedBeats,
      status: 'planned',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.chapterRepository.create(chapter)
    this.volumeRepository.updateChapterIds(volume.id, [...volume.chapterIds, chapter.id], timestamp)

    return chapter
  }
}
