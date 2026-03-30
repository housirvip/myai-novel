export const PROJECT_FILES = {
  book: 'book.json',
  outline: 'outline.json',
  volumes: 'volumes.json',
  chapters: 'chapters.json',
  characters: 'characters.json',
  locations: 'locations.json',
  factions: 'factions.json',
  hooks: 'hooks.json',
  state: 'state.json',
  shortTermMemory: 'memory/short-term.json',
  longTermMemory: 'memory/long-term.json',
} as const;

export type ProjectFileKey = keyof typeof PROJECT_FILES;
