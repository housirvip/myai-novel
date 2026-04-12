import type { PlanRetrievedContextEntityGroups, RetrievedChapterSummary, RetrievedEntity, RetrievedOutline } from "./types.js";

export interface PromptContextBlocks {
  mustFollowFacts: string[];
  recentChanges: string[];
  coreEntities: string[];
  requiredHooks: string[];
  forbiddenMoves: string[];
  supportingBackground: string[];
}

type RetrievedContextViewLike = {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  recentChapters?: RetrievedChapterSummary[];
  riskReminders?: string[];
  supportingOutlines?: RetrievedOutline[];
  characters?: RetrievedEntity[];
  factions?: RetrievedEntity[];
  items?: RetrievedEntity[];
  relations?: RetrievedEntity[];
  hooks?: RetrievedEntity[];
  worldSettings?: RetrievedEntity[];
};

export function buildPromptContextBlocks(context: unknown): PromptContextBlocks {
  const value = (context ?? {}) as RetrievedContextViewLike;
  const hardConstraints = {
    characters: value.hardConstraints?.characters ?? value.characters,
    factions: value.hardConstraints?.factions ?? value.factions,
    items: value.hardConstraints?.items ?? value.items,
    relations: value.hardConstraints?.relations ?? value.relations,
    hooks: value.hardConstraints?.hooks ?? value.hooks,
    worldSettings: value.hardConstraints?.worldSettings ?? value.worldSettings,
  } satisfies Partial<PlanRetrievedContextEntityGroups>;

  const mustFollowFacts = [
    ...summarizeEntities("人物", hardConstraints.characters, 3),
    ...summarizeEntities("势力", hardConstraints.factions, 2),
    ...summarizeEntities("物品", hardConstraints.items, 2),
    ...summarizeEntities("关系", hardConstraints.relations, 2),
    ...summarizeEntities("世界规则", hardConstraints.worldSettings, 2),
  ];

  const requiredHooks = summarizeEntities("钩子", hardConstraints.hooks, 3);
  const coreEntities = [
    ...summarizeEntities("人物", value.characters, 3),
    ...summarizeEntities("势力", value.factions, 2),
    ...summarizeEntities("物品", value.items, 2),
    ...summarizeEntities("关系", value.relations, 2),
    ...summarizeEntities("世界规则", value.worldSettings, 2),
  ];

  const recentChanges = [
    ...summarizeRecentChapters(value.recentChapters, 3),
    ...(value.riskReminders ?? []).slice(0, 3),
  ];

  const forbiddenMoves = (value.riskReminders ?? []).slice(0, 4);
  const supportingBackground = summarizeOutlines(value.supportingOutlines, 3);

  return {
    mustFollowFacts: mustFollowFacts.length > 0 ? mustFollowFacts : forbiddenMoves.slice(0, 2),
    recentChanges,
    coreEntities,
    requiredHooks,
    forbiddenMoves,
    supportingBackground,
  };
}

function summarizeEntities(label: string, entities?: RetrievedEntity[], limit = 3): string[] {
  return (entities ?? [])
    .slice(0, limit)
    .map((entity) => {
      const name = entity.name ?? entity.title ?? `#${entity.id}`;
      const summary = normalizeInline(entity.content);
      return summary ? `${label}：${name}；${summary}` : `${label}：${name}`;
    });
}

function summarizeRecentChapters(chapters?: RetrievedChapterSummary[], limit = 3): string[] {
  return (chapters ?? [])
    .slice(0, limit)
    .map((chapter) => {
      const title = chapter.title ? `《${chapter.title}》` : "";
      const summary = normalizeInline(chapter.summary);
      return summary
        ? `第${chapter.chapterNo}章${title}：${summary}`
        : `第${chapter.chapterNo}章${title}：已发生关键承接`; 
    });
}

function summarizeOutlines(outlines?: RetrievedOutline[], limit = 3): string[] {
  return (outlines ?? [])
    .slice(0, limit)
    .map((outline) => {
      const summary = normalizeInline(outline.content);
      return summary ? `${outline.title}：${summary}` : outline.title;
    });
}

function normalizeInline(value?: string | null): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "；")
    .trim();
}
