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
    private readonly options: { limit?: number } = {},
  ) {}

  async loadCandidates(
    db: Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievalCandidateBundle> {
    const baseCandidates = await this.baseProvider.loadCandidates(db, params);
    const semanticMatches = await this.searcher.search({
      queryText: params.keywords.join(" ").trim(),
      limit: this.options.limit ?? 10,
    });

    if (semanticMatches.length === 0) {
      return baseCandidates;
    }

    return {
      ...baseCandidates,
      entityGroups: mergeEntityGroups(baseCandidates.entityGroups, semanticMatches),
    };
  }
}

function mergeEntityGroups(
  entityGroups: PlanRetrievedContextEntityGroups,
  matches: EmbeddingMatch[],
): PlanRetrievedContextEntityGroups {
  return {
    hooks: mergeEntities(entityGroups.hooks, matches, "hook"),
    characters: mergeEntities(entityGroups.characters, matches, "character"),
    factions: mergeEntities(entityGroups.factions, matches, "faction"),
    items: mergeEntities(entityGroups.items, matches, "item"),
    relations: mergeEntities(entityGroups.relations, matches, "relation"),
    worldSettings: mergeEntities(entityGroups.worldSettings, matches, "world_setting"),
  };
}

function mergeEntities(
  existing: RetrievedEntity[],
  matches: EmbeddingMatch[],
  entityType: EmbeddingMatch["entityType"],
): RetrievedEntity[] {
  const byId = new Map(existing.map((entity) => [entity.id, entity]));

  for (const match of matches) {
    if (match.entityType !== entityType) {
      continue;
    }

    const existingEntity = byId.get(match.entityId);
    if (existingEntity) {
      byId.set(match.entityId, mergeSemanticSignal(existingEntity, match));
      continue;
    }

    byId.set(match.entityId, createEmbeddingOnlyEntity(match));
  }

  return Array.from(byId.values()).sort((left, right) => right.score - left.score || left.id - right.id);
}

function mergeSemanticSignal(entity: RetrievedEntity, match: EmbeddingMatch): RetrievedEntity {
  const reasons = new Set((entity.reason ?? "").split("+").filter(Boolean));
  reasons.add("embedding_support");

  return {
    ...entity,
    reason: Array.from(reasons).join("+"),
    score: (entity.score ?? 0) + Math.round(match.semanticScore * 10),
  };
}

function createEmbeddingOnlyEntity(match: EmbeddingMatch): RetrievedEntity {
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
