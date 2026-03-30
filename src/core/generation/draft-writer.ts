import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { LlmAdapter } from '../../infra/llm/types.js';
import type { Chapter } from '../../types/index.js';
import type { WritingContext } from '../context-builder.js';

export type DraftGenerationResult = {
  chapter: Chapter;
  draftPath: string;
  content: string;
};

function buildPrompt(context: WritingContext): { system: string; user: string } {
  const system = [
    '你是小说写作助手。',
    '请严格保持设定一致性，并围绕章节目标推进剧情。',
    `目标单章字数：${context.book.defaultChapterWordCount}，允许偏差比例：${context.book.chapterWordCountToleranceRatio}`,
  ].join('\n');

  const user = [
    `书名：${context.book.title}`,
    `题材：${context.book.genre}`,
    `章节标题：${context.chapter.title}`,
    `章节目标：${context.chapter.objective}`,
    `上一章总结：${context.previousChapterSummary || '无'}`,
    `章节节拍：${context.chapter.plannedBeats.join('；') || '无'}`,
    `主题：${context.outline.theme}`,
    `核心冲突：${context.outline.coreConflicts.join('；') || '无'}`,
    `最近事件：${context.shortTermMemory.recentEvents.join('；') || '无'}`,
    `关联人物：${context.relevantCharacters.map((item) => item.name).join('；') || '无'}`,
    `关联地点：${context.relevantLocations.map((item) => item.name).join('；') || '无'}`,
    `关联势力：${context.relevantFactions.map((item) => item.name).join('；') || '无'}`,
    `重要物品：${context.importantItems.map((item) => `${item.name}(${item.type}, ${item.quantity}${item.unit})`).join('；') || '无'}`,
    `活跃钩子：${context.activeHooks.map((item) => item.title).join('；') || '无'}`,
  ].join('\n');

  return { system, user };
}

export class DraftWriter {
  public constructor(
    private readonly rootDir: string,
    private readonly llm: LlmAdapter,
  ) {}

  public async generate(context: WritingContext): Promise<DraftGenerationResult> {
    const prompt = buildPrompt(context);
    const result = await this.llm.generateText(prompt);
    const draftPath = resolve(this.rootDir, 'drafts', `${context.chapter.id}.draft.md`);

    await mkdir(dirname(draftPath), { recursive: true });
    await writeFile(draftPath, result.text, 'utf8');

    return {
      chapter: {
        ...context.chapter,
        status: 'drafted',
        draftPath,
      },
      draftPath,
      content: result.text,
    };
  }
}
