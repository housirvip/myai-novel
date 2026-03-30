import { resolve } from 'node:path';

import { JsonStore } from '../infra/storage/json-store.js';
import { PROJECT_FILES } from '../infra/storage/project-layout.js';
import type {
  Book,
  Chapter,
  Character,
  Hook,
  ItemRef,
  ItemState,
  Location,
  MemoryEntry,
  Outline,
  ShortTermMemory,
  StoryState,
  Faction,
} from '../types/index.js';

export type WritingContext = {
  book: Book;
  outline: Outline;
  chapter: Chapter;
  previousChapterSummary?: string;
  relevantCharacters: Character[];
  relevantLocations: Location[];
  relevantFactions: Faction[];
  importantItems: Array<ItemRef | ItemState>;
  activeHooks: Hook[];
  storyState: StoryState;
  shortTermMemory: ShortTermMemory;
  longTermMemories: MemoryEntry[];
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function matchesChapterSignals(chapter: Chapter, values: string[]): boolean {
  const signals = [chapter.title, chapter.objective, ...chapter.plannedBeats]
    .join(' ')
    .toLowerCase();

  return values.some((value) => signals.includes(value.toLowerCase()));
}

export class ContextBuilder {
  public constructor(
    private readonly rootDir: string,
    private readonly store = new JsonStore(),
  ) {}

  public async buildForChapter(chapterId: string): Promise<WritingContext> {
    const book = await this.store.read<Book>(resolve(this.rootDir, PROJECT_FILES.book));
    const outline = await this.store.read<Outline>(resolve(this.rootDir, PROJECT_FILES.outline));
    const chapters = await this.store.read<Chapter[]>(resolve(this.rootDir, PROJECT_FILES.chapters));
    const characters = await this.store.read<Character[]>(resolve(this.rootDir, PROJECT_FILES.characters));
    const locations = await this.store.read<Location[]>(resolve(this.rootDir, PROJECT_FILES.locations));
    const factions = await this.store.read<Faction[]>(resolve(this.rootDir, PROJECT_FILES.factions));
    const hooks = await this.store.read<Hook[]>(resolve(this.rootDir, PROJECT_FILES.hooks));
    const storyState = await this.store.read<StoryState>(resolve(this.rootDir, PROJECT_FILES.state));
    const shortTermMemory = await this.store.read<ShortTermMemory>(resolve(this.rootDir, PROJECT_FILES.shortTermMemory));
    const longTermMemories = await this.store.read<MemoryEntry[]>(resolve(this.rootDir, PROJECT_FILES.longTermMemory));

    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const previousChapter = chapters
      .filter((item) => item.volumeId === chapter.volumeId && item.index < chapter.index)
      .sort((left, right) => right.index - left.index)[0];

    const activeHooks = hooks.filter((item) => item.status !== 'resolved');
    const chapterKeywords = [chapter.title, chapter.objective, ...chapter.plannedBeats]
      .join(' ')
      .toLowerCase();

    const charactersFromRecentLocations = characters.filter(
      (item) => item.currentLocationId || item.id === storyState.protagonistId,
    );
    const charactersFromHookSource = characters.filter((item) =>
      activeHooks.some((hook) => hook.sourceChapterId === chapter.id) || item.id === storyState.protagonistId,
    );
    const charactersFromChapterSignals = characters.filter((item) =>
      matchesChapterSignals(chapter, [item.name, item.role, item.profile]),
    );
    const relevantCharacters = uniqueById([
      ...charactersFromRecentLocations,
      ...charactersFromHookSource,
      ...charactersFromChapterSignals,
    ]);

    const relevantLocationIds = new Set(
      relevantCharacters.flatMap((item) => (item.currentLocationId ? [item.currentLocationId] : [])),
    );
    const relevantFactionIds = new Set(
      relevantCharacters.flatMap((item) => item.factionMemberships.map((membership) => membership.factionId)),
    );

    const relevantLocations = uniqueById(
      locations.filter(
        (item) =>
          relevantLocationIds.has(item.id) ||
          matchesChapterSignals(chapter, [item.name, item.type, item.description, ...item.tags, ...item.rules]),
      ),
    );

    const relevantFactions = uniqueById(
      factions.filter(
        (item) =>
          relevantFactionIds.has(item.id) ||
          matchesChapterSignals(chapter, [item.name, item.type, item.objective, item.description]),
      ),
    );

    const importantInventoryItems = relevantCharacters.flatMap((item) =>
      item.inventory.filter(
        (inventoryItem) =>
          inventoryItem.isUniqueWorldwide ||
          inventoryItem.quantity > 1 ||
          chapterKeywords.includes(inventoryItem.name.toLowerCase()) ||
          chapterKeywords.includes(inventoryItem.type.toLowerCase()),
      ),
    );

    const importantStateItems = storyState.itemStates.filter(
      (item) =>
        item.isUniqueWorldwide ||
        (item.ownerCharacterId ? relevantCharacters.some((character) => character.id === item.ownerCharacterId) : false) ||
        (item.locationId ? relevantLocations.some((location) => location.id === item.locationId) : false) ||
        chapterKeywords.includes(item.name.toLowerCase()) ||
        chapterKeywords.includes(item.type.toLowerCase()),
    );

    return {
      book,
      outline,
      chapter,
      previousChapterSummary: previousChapter?.summary,
      relevantCharacters,
      relevantLocations,
      relevantFactions,
      importantItems: [...importantInventoryItems, ...importantStateItems],
      activeHooks,
      storyState,
      shortTermMemory,
      longTermMemories,
    };
  }
}
