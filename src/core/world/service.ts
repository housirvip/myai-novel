import { z } from 'zod'

import type { Chapter, Character, Faction, Hook, Location, Volume } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { NovelError } from '../../shared/utils/errors.js'
import { nowIso } from '../../shared/utils/time.js'
import type { BookRepository } from '../../infra/repository/book-repository.js'
import type { CharacterRepository } from '../../infra/repository/character-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { FactionRepository } from '../../infra/repository/faction-repository.js'
import type { HookRepository } from '../../infra/repository/hook-repository.js'
import type { LocationRepository } from '../../infra/repository/location-repository.js'
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

const addCharacterInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  profile: z.string().min(1),
  motivation: z.string().min(1),
})

const addLocationInputSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
})

const addFactionInputSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  objective: z.string().min(1),
  description: z.string().min(1),
})

const addHookInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  payoffExpectation: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  sourceChapterId: z.string().optional(),
})

export type AddVolumeInput = z.input<typeof addVolumeInputSchema>
export type AddChapterInput = z.input<typeof addChapterInputSchema>
export type AddCharacterInput = z.input<typeof addCharacterInputSchema>
export type AddLocationInput = z.input<typeof addLocationInputSchema>
export type AddFactionInput = z.input<typeof addFactionInputSchema>
export type AddHookInput = z.input<typeof addHookInputSchema>

export class WorldService {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly volumeRepository: VolumeRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly locationRepository: LocationRepository,
    private readonly factionRepository: FactionRepository,
    private readonly hookRepository: HookRepository,
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

  addCharacter(input: AddCharacterInput): Character {
    const parsed = addCharacterInputSchema.parse(input)
    const book = this.requireBook()
    const timestamp = nowIso()
    const character: Character = {
      id: createId('character'),
      bookId: book.id,
      name: parsed.name,
      role: parsed.role,
      profile: parsed.profile,
      motivation: parsed.motivation,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.characterRepository.create(character)
    return character
  }

  addLocation(input: AddLocationInput): Location {
    const parsed = addLocationInputSchema.parse(input)
    const book = this.requireBook()
    const timestamp = nowIso()
    const location: Location = {
      id: createId('location'),
      bookId: book.id,
      name: parsed.name,
      type: parsed.type,
      description: parsed.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.locationRepository.create(location)
    return location
  }

  addFaction(input: AddFactionInput): Faction {
    const parsed = addFactionInputSchema.parse(input)
    const book = this.requireBook()
    const timestamp = nowIso()
    const faction: Faction = {
      id: createId('faction'),
      bookId: book.id,
      name: parsed.name,
      type: parsed.type,
      objective: parsed.objective,
      description: parsed.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.factionRepository.create(faction)
    return faction
  }

  addHook(input: AddHookInput): Hook {
    const parsed = addHookInputSchema.parse(input)
    const book = this.requireBook()
    const timestamp = nowIso()
    const hook: Hook = {
      id: createId('hook'),
      bookId: book.id,
      title: parsed.title,
      sourceChapterId: parsed.sourceChapterId,
      description: parsed.description,
      payoffExpectation: parsed.payoffExpectation,
      priority: parsed.priority,
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.hookRepository.create(hook)
    return hook
  }

  private requireBook() {
    const book = this.bookRepository.getFirst()

    if (!book) {
      throw new NovelError('Project is not initialized. Run `novel init` first.')
    }

    return book
  }
}
