import { buildRecentChanges } from "./recent-changes.js";
import { buildPriorityContext } from "./retrieval-facts.js";
import { buildHardConstraints } from "./retrieval-hard-constraints.js";
import { buildRiskReminders } from "./retrieval-risk-reminders.js";
import type { PlanRetrievedContext } from "./types.js";
import type { RetrievalRerankerOutput } from "./retrieval-pipeline.js";

export function buildRetrievedContext(input: {
  book: {
    id: number;
    title: string;
    summary: string | null;
    target_chapter_count: number | null;
    current_chapter_count: number;
  };
  reranked: RetrievalRerankerOutput;
}): PlanRetrievedContext {
  const outlines = input.reranked.outlines;
  const recentChapters = input.reranked.recentChapters;
  const entityGroups = input.reranked.entityGroups;
  const { hooks, characters, factions, items, relations, worldSettings } = entityGroups;

  const hardConstraints = buildHardConstraints(entityGroups);
  const riskReminders = buildRiskReminders({
    hardConstraints,
    recentChapters,
  });
  const priorityContext = buildPriorityContext({
    hardConstraints,
    softReferences: entityGroups,
  });
  const recentChanges = buildRecentChanges({
    recentChapters,
    riskReminders,
    entities: [
      ...hardConstraints.characters,
      ...hardConstraints.items,
      ...hardConstraints.relations,
      ...hardConstraints.hooks,
      ...hardConstraints.worldSettings,
    ],
  });

  return {
    book: {
      id: input.book.id,
      title: input.book.title,
      summary: input.book.summary,
      targetChapterCount: input.book.target_chapter_count,
      currentChapterCount: input.book.current_chapter_count,
    },
    outlines,
    recentChapters,
    hooks,
    characters,
    factions,
    items,
    relations,
    worldSettings,
    hardConstraints,
    softReferences: {
      outlines,
      recentChapters,
      entities: entityGroups,
    },
    priorityContext,
    recentChanges,
    riskReminders,
  };
}
