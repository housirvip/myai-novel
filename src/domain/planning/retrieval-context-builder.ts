import { buildRecentChanges } from "./recent-changes.js";
import { buildRetrievalObservability } from "./retrieval-observability.js";
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
  // 这里是 retrieval 链路真正把“候选结果”收敛成“可持久化共享上下文”的地方。
  // 前面 provider / reranker 只负责找和排，这里才决定哪些结构会被后续 workflow 长期复用。
  const outlines = input.reranked.outlines;
  const recentChapters = input.reranked.recentChapters;
  const entityGroups = input.reranked.entityGroups;
  const { hooks, characters, factions, items, relations, worldSettings } = entityGroups;

  const hardConstraints = buildHardConstraints(entityGroups);
  // 这些派生视图不是彼此独立的功能点，而是围绕同一批候选事实做不同裁剪：
  // hardConstraints 给模型保底，riskReminders 暴露易错点，priorityContext 负责 prompt 分层，recentChanges 强调近期状态变化。
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
  const retrievalObservability = buildRetrievalObservability({
    candidates: entityGroups,
    hardConstraints,
    priorityContext,
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
      // softReferences 保留较完整的候选池，供不同阶段按需继续裁剪；
      // 它和 hardConstraints 的关系不是二选一，而是“共享基线 + 强约束子集”。
      outlines,
      recentChapters,
      entities: entityGroups,
    },
    priorityContext,
    retrievalObservability,
    recentChanges,
    riskReminders,
  };
}
