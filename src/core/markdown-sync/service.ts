import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { JsonStore } from '../../infra/storage/json-store.js';
import { PROJECT_FILES, type ProjectFileKey } from '../../infra/storage/project-layout.js';
import type { BackupManifest, MarkdownSyncTarget } from '../../types/index.js';

const TARGET_TO_FILE: Record<Exclude<MarkdownSyncTarget, 'all'>, string> = {
  book: PROJECT_FILES.book,
  outline: PROJECT_FILES.outline,
  volumes: PROJECT_FILES.volumes,
  chapters: PROJECT_FILES.chapters,
  characters: PROJECT_FILES.characters,
  locations: PROJECT_FILES.locations,
  factions: PROJECT_FILES.factions,
  hooks: PROJECT_FILES.hooks,
  state: PROJECT_FILES.state,
  'short-term-memory': PROJECT_FILES.shortTermMemory,
  'long-term-memory': PROJECT_FILES.longTermMemory,
};

const TARGET_TO_MARKDOWN: Record<Exclude<MarkdownSyncTarget, 'all'>, string> = {
  book: 'exports/markdown/book.md',
  outline: 'exports/markdown/outline.md',
  volumes: 'exports/markdown/volumes.md',
  chapters: 'exports/markdown/chapters.md',
  characters: 'exports/markdown/characters.md',
  locations: 'exports/markdown/locations.md',
  factions: 'exports/markdown/factions.md',
  hooks: 'exports/markdown/hooks.md',
  state: 'exports/markdown/state.md',
  'short-term-memory': 'exports/markdown/short-term-memory.md',
  'long-term-memory': 'exports/markdown/long-term-memory.md',
};

function expandTarget(target: MarkdownSyncTarget): Exclude<MarkdownSyncTarget, 'all'>[] {
  if (target === 'all') {
    return Object.keys(TARGET_TO_FILE) as Exclude<MarkdownSyncTarget, 'all'>[];
  }

  return [target];
}

function safeTimestamp(date = new Date()): string {
  return date.toISOString().replace(/:/g, '-');
}

function buildMarkdownDocument(target: Exclude<MarkdownSyncTarget, 'all'>, payload: unknown): string {
  return [
    `# ${target}`,
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
  ].join('\n');
}

function parseMarkdownDocument(markdown: string): unknown {
  const match = markdown.match(/```json\n([\s\S]*?)\n```/);

  if (!match) {
    throw new Error('Markdown 文件缺少 ```json 代码块');
  }

  return JSON.parse(match[1]);
}

async function ensureUniqueBackupDir(rootDir: string, baseName: string): Promise<string> {
  const backupRoot = resolve(rootDir, 'backup');
  await mkdir(backupRoot, { recursive: true });

  const existing = new Set(await readdir(backupRoot).catch(() => []));
  if (!existing.has(baseName)) {
    return join(backupRoot, baseName);
  }

  let index = 2;
  while (existing.has(`${baseName}-${index}`)) {
    index += 1;
  }

  return join(backupRoot, `${baseName}-${index}`);
}

export class MarkdownSyncService {
  public constructor(
    private readonly rootDir: string,
    private readonly store = new JsonStore(),
  ) {}

  public async exportToMarkdown(target: MarkdownSyncTarget): Promise<string[]> {
    const targets = expandTarget(target);
    const outputPaths: string[] = [];

    for (const currentTarget of targets) {
      const jsonPath = resolve(this.rootDir, TARGET_TO_FILE[currentTarget]);
      const markdownPath = resolve(this.rootDir, TARGET_TO_MARKDOWN[currentTarget]);
      const payload = await this.store.read<unknown>(jsonPath);
      const document = buildMarkdownDocument(currentTarget, payload);

      await mkdir(dirname(markdownPath), { recursive: true });
      await writeFile(markdownPath, document, 'utf8');
      outputPaths.push(markdownPath);
    }

    return outputPaths;
  }

  public async importFromMarkdown(target: MarkdownSyncTarget): Promise<BackupManifest> {
    const targets = expandTarget(target);
    const sourceFiles = targets.map((item) => TARGET_TO_MARKDOWN[item]);
    const backupId = `import-${safeTimestamp()}`;
    const backupDir = await ensureUniqueBackupDir(this.rootDir, backupId);
    const backupDataDir = join(backupDir, 'data');
    const backedUpFiles: string[] = [];
    const errors: string[] = [];

    await mkdir(backupDataDir, { recursive: true });

    for (const currentTarget of targets) {
      const jsonRelativePath = TARGET_TO_FILE[currentTarget];
      const markdownRelativePath = TARGET_TO_MARKDOWN[currentTarget];
      const jsonPath = resolve(this.rootDir, jsonRelativePath);
      const markdownPath = resolve(this.rootDir, markdownRelativePath);
      const backupPath = resolve(backupDataDir, jsonRelativePath);

      try {
        await mkdir(dirname(backupPath), { recursive: true });
        await copyFile(jsonPath, backupPath);
        backedUpFiles.push(jsonRelativePath);

        const markdown = await readFile(markdownPath, 'utf8');
        const parsed = parseMarkdownDocument(markdown);
        await this.store.write(jsonPath, parsed);
      } catch (error) {
        errors.push(`${currentTarget}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const manifest: BackupManifest = {
      backupId: backupDir.split('/').at(-1) ?? backupId,
      createdAt: new Date().toISOString(),
      trigger: 'import-markdown',
      target,
      sourceFiles,
      backedUpFiles,
      restoreHint: `novel backup restore ${backupDir.split('/').at(-1) ?? backupId}`,
      result: errors.length === 0 ? 'success' : backedUpFiles.length > 0 ? 'partial-failed' : 'failed',
      errors,
    };

    await this.store.write(resolve(backupDir, 'manifest.json'), manifest);
    return manifest;
  }

  public async listBackups(): Promise<string[]> {
    const backupRoot = resolve(this.rootDir, 'backup');
    return readdir(backupRoot).catch(() => []);
  }
}
