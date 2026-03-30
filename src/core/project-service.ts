import { resolve } from 'node:path';

import { JsonStore } from '../infra/storage/json-store.js';
import { PROJECT_FILES } from '../infra/storage/project-layout.js';
import type {
  Chapter,
  Character,
  Faction,
  Hook,
  Location,
  Outline,
  Volume,
} from '../types/index.js';

export class ProjectService {
  public constructor(
    private readonly rootDir: string,
    private readonly store = new JsonStore(),
  ) {}

  public async getOutline(): Promise<Outline> {
    return this.store.read<Outline>(resolve(this.rootDir, PROJECT_FILES.outline));
  }

  public async saveOutline(outline: Outline): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.outline), outline);
  }

  public async listVolumes(): Promise<Volume[]> {
    return this.store.read<Volume[]>(resolve(this.rootDir, PROJECT_FILES.volumes));
  }

  public async saveVolumes(volumes: Volume[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.volumes), volumes);
  }

  public async listChapters(): Promise<Chapter[]> {
    return this.store.read<Chapter[]>(resolve(this.rootDir, PROJECT_FILES.chapters));
  }

  public async saveChapters(chapters: Chapter[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.chapters), chapters);
  }

  public async listCharacters(): Promise<Character[]> {
    return this.store.read<Character[]>(resolve(this.rootDir, PROJECT_FILES.characters));
  }

  public async saveCharacters(characters: Character[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.characters), characters);
  }

  public async listLocations(): Promise<Location[]> {
    return this.store.read<Location[]>(resolve(this.rootDir, PROJECT_FILES.locations));
  }

  public async saveLocations(locations: Location[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.locations), locations);
  }

  public async listFactions(): Promise<Faction[]> {
    return this.store.read<Faction[]>(resolve(this.rootDir, PROJECT_FILES.factions));
  }

  public async saveFactions(factions: Faction[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.factions), factions);
  }

  public async listHooks(): Promise<Hook[]> {
    return this.store.read<Hook[]>(resolve(this.rootDir, PROJECT_FILES.hooks));
  }

  public async saveHooks(hooks: Hook[]): Promise<void> {
    await this.store.write(resolve(this.rootDir, PROJECT_FILES.hooks), hooks);
  }
}
