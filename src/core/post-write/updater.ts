import { resolve } from 'node:path';

import { JsonStore } from '../../infra/storage/json-store.js';
import { PROJECT_FILES } from '../../infra/storage/project-layout.js';
import type { Chapter, Hook, MemoryEntry, StoryState } from '../../types/index.js';

export type PostWriteUpdateResult = {
  chapterId: string;
  storyStateUpdated: boolean;
  longTermMemoryCount: number;
  activeHookCount: number;
};

export class PostWriteUpdater {
  public constructor(
    private readonly rootDir: string,
    private readonly store = new JsonStore(),
  ) {}

  public async updateAfterDraft(chapter: Chapter): Promise<PostWriteUpdateResult> {
    const statePath = resolve(this.rootDir, PROJECT_FILES.state);
    const memoryPath = resolve(this.rootDir, PROJECT_FILES.longTermMemory);
    const hookPath = resolve(this.rootDir, PROJECT_FILES.hooks);

    const state = await this.store.read<StoryState>(statePath);
    const longTermMemory = await this.store.read<MemoryEntry[]>(memoryPath);
    const hooks = await this.store.read<Hook[]>(hookPath);

    state.currentChapterId = chapter.id;
    state.recentEvents = [...state.recentEvents, `章节 ${chapter.title} 已生成草稿`].slice(-10);

    const memoryEntry: MemoryEntry = {
      id: `memory-${Date.now()}`,
      type: 'event',
      summary: `章节 ${chapter.title} 已生成草稿`,
      sourceChapterId: chapter.id,
      importance: 0.4,
      tags: ['draft', chapter.id],
      lastUsedAt: new Date().toISOString(),
    };

    const nextHooks = hooks.map((item) =>
      item.sourceChapterId === chapter.id && item.status === 'open'
        ? { ...item, status: 'foreshadowed' as const }
        : item,
    );

    await this.store.write(statePath, state);
    await this.store.write(memoryPath, [...longTermMemory, memoryEntry]);
    await this.store.write(hookPath, nextHooks);

    return {
      chapterId: chapter.id,
      storyStateUpdated: true,
      longTermMemoryCount: longTermMemory.length + 1,
      activeHookCount: nextHooks.filter((item) => item.status !== 'resolved').length,
    };
  }
}
