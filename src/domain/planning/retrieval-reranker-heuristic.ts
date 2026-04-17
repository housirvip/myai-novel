import type {
  RetrievalReranker,
  RetrievalRerankerInput,
  RetrievalRerankerOutput,
} from "./retrieval-pipeline.js";
import type { RetrievedEntity, RetrievedFactEntityType } from "./types.js";
import { continuityBonus, countKeywordHits, hasReason } from "./retrieval-features.js";

export class HeuristicReranker implements RetrievalReranker {
  async rerank(input: RetrievalRerankerInput): Promise<RetrievalRerankerOutput> {
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
