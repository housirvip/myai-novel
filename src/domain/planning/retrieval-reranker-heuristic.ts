import type {
  RetrievalReranker,
  RetrievalRerankerInput,
  RetrievalRerankerOutput,
} from "./retrieval-pipeline.js";
import type { RetrievedEntity, RetrievedFactEntityType } from "./types.js";
import { continuityBonus, countKeywordHits, hasReason } from "./retrieval-features.js";

export class HeuristicReranker implements RetrievalReranker {
  async rerank(input: RetrievalRerankerInput): Promise<RetrievalRerankerOutput> {
    // heuristic reranker 不试图重新“理解剧情”，而是在已有规则召回结果上做轻量重排。
    // 这样即便启发式权重不完美，也更像是在调排序，而不是推翻前面的候选边界。
    return {
      outlines: input.candidates.outlines,
      recentChapters: input.candidates.recentChapters,
      entityGroups: {
        hooks: rerankEntities(input.candidates.entityGroups.hooks, input, "hook"),
        characters: rerankEntities(input.candidates.entityGroups.characters, input, "character"),
        factions: rerankEntities(input.candidates.entityGroups.factions, input, "faction"),
        items: rerankEntities(input.candidates.entityGroups.items, input, "item"),
        relations: rerankEntities(input.candidates.entityGroups.relations, input, "relation"),
        worldSettings: rerankEntities(input.candidates.entityGroups.worldSettings, input, "world_setting"),
      },
    };
  }
}

type HeuristicEntityType = RetrievedFactEntityType;

interface HeuristicScoreBreakdown {
  baseScore: number;
  manualBoost: number;
  keywordBoost: number;
  embeddingBoost: number;
  continuityBoost: number;
  hookBonus: number;
  finalScore: number;
}

function rerankEntities(
  entities: RetrievedEntity[],
  input: RetrievalRerankerInput,
  entityType: HeuristicEntityType,
): RetrievedEntity[] {
  // 这里只改顺序，不改实体内容。
  // 最终如果分数打平，就退回到稳定的 id 顺序，避免同一输入在排序上出现不必要抖动。
  return [...entities]
    .sort((left, right) => {
      const scoreDiff = computeHeuristicScore(right, input, entityType) - computeHeuristicScore(left, input, entityType);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.id - right.id;
    });
}

function computeHeuristicScore(
  entity: RetrievedEntity,
  input: RetrievalRerankerInput,
  entityType: HeuristicEntityType,
): number {
  return computeHeuristicScoreBreakdown(entity, input, entityType).finalScore;
}

function computeHeuristicScoreBreakdown(
  entity: RetrievedEntity,
  input: RetrievalRerankerInput,
  entityType: HeuristicEntityType,
): HeuristicScoreBreakdown {
  // 分数构成刻意拆成多个小项，方便后面排查“为什么某个实体被抬上来”。
  // 当前虽然只返回 finalScore，但 breakdown 保留了后续做 explain/debug 的扩展空间。
  const content = entity.content ?? "";
  const normalizedContent = content.toLowerCase();
  const baseScore = entity.score ?? 0;
  const manualBoost = hasReason(entity, "manual_id") ? 40 : 0;
  const keywordBoost = hasReason(entity, "keyword_hit") ? 15 : 0;
  const embeddingBoost =
    (hasReason(entity, "embedding_match") ? 10 : 0)
    + (hasReason(entity, "embedding_support") ? 6 : 0);
  const continuityBoost =
    countKeywordHits(input.params.keywords, normalizedContent) * 4
    + continuityBonus(normalizedContent, entityType);
  const hookBonus = entityType === "hook"
    ? hookChapterBonus(content, input.params.chapterNo)
    : 0;
  const finalScore = baseScore + manualBoost + keywordBoost + embeddingBoost + continuityBoost + hookBonus;

  return {
    baseScore,
    manualBoost,
    keywordBoost,
    embeddingBoost,
    continuityBoost,
    hookBonus,
    finalScore,
  };
}

function hookChapterBonus(content: string, chapterNo: number): number {
  // 钩子实体额外看目标章节距离，
  // 因为“即将回收的伏笔”通常比长期背景设定更应该进入当前章节的上下文前排。
  const match = content.match(/target_chapter_no=(\d+)/);
  if (!match) {
    return 0;
  }

  const targetChapterNo = Number(match[1]);
  const distance = Math.abs(targetChapterNo - chapterNo);
  if (distance === 0) {
    return 30;
  }
  if (distance === 1) {
    return 20;
  }
  if (distance === 2) {
    return 10;
  }
  return 0;
}
