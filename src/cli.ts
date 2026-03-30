import { Command } from 'commander';
import { resolve } from 'node:path';

import { MarkdownSyncService } from './core/markdown-sync/service.js';
import { ProjectService } from './core/project-service.js';
import { JsonStore } from './infra/storage/json-store.js';
import { PROJECT_FILES } from './infra/storage/project-layout.js';
import type { Book, BookProject, Character, Chapter, Faction, Hook, Location, Outline, ShortTermMemory, StoryState, Volume } from './types/index.js';

const store = new JsonStore();

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function createDefaultBook(): Book {
  const now = new Date().toISOString();

  return {
    id: 'book-001',
    title: '未命名小说',
    genre: '未分类',
    styleGuide: [],
    defaultChapterWordCount: 3000,
    chapterWordCountToleranceRatio: 0.15,
    model: {
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      temperature: 0.8,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createDefaultOutline(): Outline {
  return {
    premise: '',
    theme: '',
    worldview: '',
    coreConflicts: [],
    endingVision: '',
  };
}

function createDefaultState(): StoryState {
  return {
    currentChapterId: '',
    protagonistId: '',
    locations: [],
    itemStates: [],
    activeThreads: [],
    resolvedThreads: [],
    recentEvents: [],
  };
}

function createDefaultShortTermMemory(): ShortTermMemory {
  return {
    recentChapterIds: [],
    summaries: [],
    recentEvents: [],
    temporaryConstraints: [],
  };
}

async function initializeProject(rootDir: string): Promise<void> {
  await store.write(resolve(rootDir, PROJECT_FILES.book), createDefaultBook());
  await store.write(resolve(rootDir, PROJECT_FILES.outline), createDefaultOutline());
  await store.write(resolve(rootDir, PROJECT_FILES.volumes), []);
  await store.write(resolve(rootDir, PROJECT_FILES.chapters), []);
  await store.write(resolve(rootDir, PROJECT_FILES.characters), []);
  await store.write(resolve(rootDir, PROJECT_FILES.locations), []);
  await store.write(resolve(rootDir, PROJECT_FILES.factions), []);
  await store.write(resolve(rootDir, PROJECT_FILES.hooks), []);
  await store.write(resolve(rootDir, PROJECT_FILES.state), createDefaultState());
  await store.write(resolve(rootDir, PROJECT_FILES.shortTermMemory), createDefaultShortTermMemory());
  await store.write(resolve(rootDir, PROJECT_FILES.longTermMemory), []);
}

async function loadProject(rootDir: string): Promise<BookProject> {
  return {
    book: await store.read<Book>(resolve(rootDir, PROJECT_FILES.book)),
    outline: await store.read<Outline>(resolve(rootDir, PROJECT_FILES.outline)),
    volumes: await store.read(resolve(rootDir, PROJECT_FILES.volumes)),
    chapters: await store.read(resolve(rootDir, PROJECT_FILES.chapters)),
    characters: await store.read(resolve(rootDir, PROJECT_FILES.characters)),
    locations: await store.read(resolve(rootDir, PROJECT_FILES.locations)),
    factions: await store.read(resolve(rootDir, PROJECT_FILES.factions)),
    hooks: await store.read(resolve(rootDir, PROJECT_FILES.hooks)),
    state: await store.read<StoryState>(resolve(rootDir, PROJECT_FILES.state)),
    shortTermMemory: await store.read<ShortTermMemory>(resolve(rootDir, PROJECT_FILES.shortTermMemory)),
    longTermMemory: await store.read(resolve(rootDir, PROJECT_FILES.longTermMemory)),
  };
}

const program = new Command();

program
  .name('novel')
  .description('AI 小说命令行工具')
  .version('0.1.0');

program
  .command('book')
  .description('书籍配置相关命令')
  .command('show')
  .description('显示当前书籍配置')
  .option('--root <path>', '项目根目录', '.')
  .action(async ({ root }: { root: string }) => {
    const project = await loadProject(resolve(root));

    console.log(JSON.stringify(project.book, null, 2));
  });

program
  .command('init')
  .description('初始化小说项目')
  .option('--root <path>', '项目根目录', '.')
  .action(async ({ root }: { root: string }) => {
    const rootDir = resolve(root);

    await initializeProject(rootDir);
    console.log(`initialized project at ${rootDir}`);
  });

program
  .command('export')
  .description('导出数据')
  .command('markdown [target]')
  .description('导出 JSON 为 Markdown')
  .option('--root <path>', '项目根目录', '.')
  .action(async (target = 'all', options: { root: string }) => {
    const service = new MarkdownSyncService(resolve(options.root));
    const outputs = await service.exportToMarkdown(target as Parameters<MarkdownSyncService['exportToMarkdown']>[0]);

    console.log(JSON.stringify(outputs, null, 2));
  });

program
  .command('import')
  .description('导入数据')
  .command('markdown [target]')
  .description('从 Markdown 导入并覆盖 JSON')
  .option('--root <path>', '项目根目录', '.')
  .action(async (target = 'all', options: { root: string }) => {
    const service = new MarkdownSyncService(resolve(options.root));
    const manifest = await service.importFromMarkdown(target as Parameters<MarkdownSyncService['importFromMarkdown']>[0]);

    console.log(JSON.stringify(manifest, null, 2));
  });

const backup = program.command('backup').description('backup 管理');

backup
  .command('list')
  .description('列出所有 backup')
  .option('--root <path>', '项目根目录', '.')
  .action(async ({ root }: { root: string }) => {
    const service = new MarkdownSyncService(resolve(root));
    const backups = await service.listBackups();

    console.log(JSON.stringify(backups, null, 2));
  });

program
  .command('outline')
  .description('大纲相关命令')
  .command('set')
  .requiredOption('--premise <text>', '故事提要')
  .requiredOption('--theme <text>', '主题')
  .requiredOption('--worldview <text>', '世界观')
  .requiredOption('--conflict <text...>', '核心冲突，可传多个')
  .requiredOption('--ending <text>', '结局方向')
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { premise: string; theme: string; worldview: string; conflict: string[]; ending: string; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    await service.saveOutline({
      premise: options.premise,
      theme: options.theme,
      worldview: options.worldview,
      coreConflicts: options.conflict,
      endingVision: options.ending,
    });
    console.log('outline updated');
  });

program
  .command('volume')
  .description('分卷相关命令')
  .command('add')
  .requiredOption('--title <text>', '标题')
  .requiredOption('--goal <text>', '目标')
  .option('--summary <text>', '摘要', '')
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { title: string; goal: string; summary: string; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const volumes = await service.listVolumes();
    const volume: Volume = { id: createId('volume'), title: options.title, goal: options.goal, summary: options.summary, chapterIds: [] };
    volumes.push(volume);
    await service.saveVolumes(volumes);
    console.log(JSON.stringify(volume, null, 2));
  });

program
  .command('chapter')
  .description('章节相关命令')
  .command('add')
  .requiredOption('--volume-id <id>', '所属分卷 ID')
  .requiredOption('--title <text>', '标题')
  .requiredOption('--objective <text>', '目标')
  .option('--beat <text...>', '节拍，可传多个', [])
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { volumeId: string; title: string; objective: string; beat: string[]; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const chapters = await service.listChapters();
    const volumes = await service.listVolumes();
    const chapter: Chapter = {
      id: createId('chapter'),
      volumeId: options.volumeId,
      index: chapters.filter((item) => item.volumeId === options.volumeId).length + 1,
      title: options.title,
      objective: options.objective,
      plannedBeats: options.beat,
      status: 'planned',
    };
    chapters.push(chapter);
    await service.saveChapters(chapters);
    const volume = volumes.find((item) => item.id === options.volumeId);
    if (volume) {
      volume.chapterIds.push(chapter.id);
      await service.saveVolumes(volumes);
    }
    console.log(JSON.stringify(chapter, null, 2));
  });

program
  .command('character')
  .description('角色相关命令')
  .command('add')
  .requiredOption('--name <text>', '角色名')
  .requiredOption('--role <text>', '角色定位')
  .option('--profile <text>', '角色简介', '')
  .option('--motivation <text>', '动机', '')
  .option('--class-name <text>', '职业', '未定')
  .option('--rank <text>', '等级', '未定')
  .option('--location-id <id>', '当前位置 ID')
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { name: string; role: string; profile: string; motivation: string; className: string; rank: string; locationId?: string; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const characters = await service.listCharacters();
    const character: Character = {
      id: createId('character'),
      name: options.name,
      role: options.role,
      profile: options.profile,
      motivation: options.motivation,
      secrets: [],
      relationships: [],
      inventory: [],
      currentLocationId: options.locationId,
      factionMemberships: [],
      progression: { className: options.className, rank: options.rank, abilities: [] },
      statusNotes: [],
    };
    characters.push(character);
    await service.saveCharacters(characters);
    console.log(JSON.stringify(character, null, 2));
  });

program
  .command('location')
  .description('地点相关命令')
  .command('add')
  .requiredOption('--name <text>', '地点名')
  .requiredOption('--type <text>', '地点类型')
  .option('--description <text>', '描述', '')
  .option('--status <text>', '状态', '正常')
  .option('--tag <text...>', '标签', [])
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { name: string; type: string; description: string; status: string; tag: string[]; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const locations = await service.listLocations();
    const location: Location = {
      id: createId('location'),
      name: options.name,
      type: options.type,
      description: options.description,
      rules: [],
      status: options.status,
      tags: options.tag,
    };
    locations.push(location);
    await service.saveLocations(locations);
    console.log(JSON.stringify(location, null, 2));
  });

program
  .command('faction')
  .description('势力相关命令')
  .command('add')
  .requiredOption('--name <text>', '势力名')
  .requiredOption('--type <text>', '势力类型')
  .option('--objective <text>', '目标', '')
  .option('--description <text>', '描述', '')
  .option('--status <text>', '状态', '正常')
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { name: string; type: string; objective: string; description: string; status: string; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const factions = await service.listFactions();
    const faction: Faction = {
      id: createId('faction'),
      name: options.name,
      type: options.type,
      objective: options.objective,
      description: options.description,
      keyCharacterIds: [],
      memberRoles: [],
      locationIds: [],
      allyFactionIds: [],
      rivalFactionIds: [],
      status: options.status,
    };
    factions.push(faction);
    await service.saveFactions(factions);
    console.log(JSON.stringify(faction, null, 2));
  });

program
  .command('hook')
  .description('钩子相关命令')
  .command('add')
  .requiredOption('--title <text>', '标题')
  .requiredOption('--chapter-id <id>', '来源章节 ID')
  .requiredOption('--description <text>', '描述')
  .option('--payoff <text>', '回收预期', '')
  .option('--priority <level>', '优先级', 'medium')
  .option('--root <path>', '项目根目录', '.')
  .action(async (options: { title: string; chapterId: string; description: string; payoff: string; priority: Hook['priority']; root: string }) => {
    const service = new ProjectService(resolve(options.root));
    const hooks = await service.listHooks();
    const hook: Hook = {
      id: createId('hook'),
      title: options.title,
      sourceChapterId: options.chapterId,
      description: options.description,
      payoffExpectation: options.payoff,
      priority: options.priority,
      status: 'open',
    };
    hooks.push(hook);
    await service.saveHooks(hooks);
    console.log(JSON.stringify(hook, null, 2));
  });

program.parseAsync(process.argv);
