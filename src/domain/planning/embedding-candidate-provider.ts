import { env } from "../../config/env.js";
import type { Kysely } from "kysely";

import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type { EmbeddingMatch } from "./embedding-types.js";
import type {
  RetrievalCandidateBundle,
  RetrievalCandidateProvider,
  RetrievePlanContextParams,
} from "./retrieval-pipeline.js";
import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "./types.js";

export interface EmbeddingCandidateSearcher {
  search(params: { queryText: string; limit: number }): Promise<EmbeddingMatch[]>;
}

export class EmbeddingCandidateProvider implements RetrievalCandidateProvider {
  constructor(
    private readonly baseProvider: RetrievalCandidateProvider,
    private readonly searcher: EmbeddingCandidateSearcher,
    private readonly options: { limit?: number; minScore?: number; minEmbeddingOnlyScore?: number } = {},
  ) {}

  async loadCandidates(
    db: Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievalCandidateBundle> {
    const baseCandidates = await this.baseProvider.loadCandidates(db, params);
    const semanticQuery = params.queryText.trim() || params.keywords.join(" ").trim();

    if (!semanticQuery) {
      return baseCandidates;
    }

    // embedding 查询这里只消费已经整理过的关键词串，
    // 而不是直接把整段作者意图原文丢给向量搜索，避免语义召回被长文本噪声主导。
    const semanticMatches = await this.searcher.search({
      queryText: semanticQuery,
      limit: this.options.limit ?? 10,
    });

    if (semanticMatches.length === 0) {
      return baseCandidates;
    }

    return {
      ...baseCandidates,
      entityGroups: mergeEntityGroups(baseCandidates.entityGroups, semanticMatches, {
        minScore: this.options.minScore ?? env.PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE,
        minEmbeddingOnlyScore: this.options.minEmbeddingOnlyScore ?? env.PLANNING_RETRIEVAL_EMBEDDING_ONLY_MIN_SCORE,
      }),
    };
  }
}

function mergeEntityGroups(
  entityGroups: PlanRetrievedContextEntityGroups,
  matches: EmbeddingMatch[],
  options: { minScore: number; minEmbeddingOnlyScore: number },
): PlanRetrievedContextEntityGroups {
  return {
    hooks: mergeEntities(entityGroups.hooks, matches, "hook", options),
    characters: mergeEntities(entityGroups.characters, matches, "character", options),
    factions: mergeEntities(entityGroups.factions, matches, "faction", options),
    items: mergeEntities(entityGroups.items, matches, "item", options),
    relations: mergeEntities(entityGroups.relations, matches, "relation", options),
    worldSettings: mergeEntities(entityGroups.worldSettings, matches, "world_setting", options),
  };
}

function mergeEntities(
  existing: RetrievedEntity[],
  matches: EmbeddingMatch[],
  entityType: EmbeddingMatch["entityType"],
  options: { minScore: number; minEmbeddingOnlyScore: number },
): RetrievedEntity[] {
  // 合并策略不是“语义召回覆盖规则召回”，而是按实体 id 把语义信号叠加进已有候选。
  // 这样 embedding 更像是加权补充，而不是另起一套完全独立的候选池。
  const byId = new Map(existing.map((entity) => [entity.id, entity]));

  for (const match of matches) {
    if (match.entityType !== entityType) {
      continue;
    }

    const existingEntity = byId.get(match.entityId);
    if (existingEntity) {
      if (match.semanticScore < options.minScore) {
        continue;
      }
      byId.set(match.entityId, mergeSemanticSignal(existingEntity, match));
      continue;
    }

    if (match.semanticScore < options.minEmbeddingOnlyScore) {
      continue;
    }

    byId.set(match.entityId, createEmbeddingOnlyEntity(match));
  }

  return Array.from(byId.values()).sort((left, right) => right.score - left.score || left.id - right.id);
}

function mergeSemanticSignal(entity: RetrievedEntity, match: EmbeddingMatch): RetrievedEntity {
  // 已存在实体只补 reason 和少量分数，
  // 目的是告诉后续 reranker“这条不只是规则命中，也得到了语义支持”。
  const reasons = new Set((entity.reason ?? "").split("+").filter(Boolean));
  reasons.add("embedding_support");

  return {
    ...entity,
    reason: Array.from(reasons).join("+"),
    score: (entity.score ?? 0) + Math.round(match.semanticScore * 10),
  };
}

function createEmbeddingOnlyEntity(match: EmbeddingMatch): RetrievedEntity {
  // 规则召回完全没捞到、但 embedding 命中的实体，会以“embedding-only 候选”补进来。
  // 它们后面仍要经过 hardConstraints / priorityContext 等收敛步骤，不会直接跳过主链路。
  return {
    id: match.entityId,
    name: shouldUseNameField(match.entityType) ? match.displayName : undefined,
    title: shouldUseNameField(match.entityType) ? undefined : match.displayName,
    reason: "embedding_match",
    content: match.text,
    score: Math.round(match.semanticScore * 100),
    relationEndpoints: match.entityType === "relation" ? match.relationEndpoints : undefined,
    relationMetadata: match.entityType === "relation" ? match.relationMetadata : undefined,
  };
}

function shouldUseNameField(entityType: EmbeddingMatch["entityType"]): boolean {
  return entityType !== "hook" && entityType !== "world_setting" && entityType !== "chapter";
}
