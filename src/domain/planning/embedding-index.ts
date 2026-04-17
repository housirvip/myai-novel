import {
  buildCharacterEmbeddingText,
  buildFactionEmbeddingText,
  buildHookEmbeddingText,
  buildItemEmbeddingText,
  buildRelationEmbeddingText,
  buildWorldSettingEmbeddingText,
} from "./embedding-text.js";
import type {
  EmbeddingDocument,
  RelationEmbeddingEndpoint,
  RelationEmbeddingMetadata,
  RelationEmbeddingSource,
} from "./embedding-types.js";

interface CharacterEmbeddingSource {
  id: number;
  name: string;
  alias?: string | null;
  summary?: string | null;
  goal?: string | null;
  background?: string | null;
  personality?: string | null;
  current_location?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface HookEmbeddingSource {
  id: number;
  title: string;
  description?: string | null;
  foreshadowing?: string | null;
  expected_payoff?: string | null;
  status?: string | null;
  target_chapter_no?: number | null;
  notes?: string | null;
}

interface FactionEmbeddingSource {
  id: number;
  name: string;
  category?: string | null;
  summary?: string | null;
  core_goal?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface ItemEmbeddingSource {
  id: number;
  name: string;
  description?: string | null;
  ability?: string | null;
  summary?: string | null;
  status?: string | null;
  ownerSummary?: string | null;
  notes?: string | null;
}

interface WorldSettingEmbeddingSource {
  id: number;
  title: string;
  category?: string | null;
  content?: string | null;
  notes?: string | null;
}

export function buildEmbeddingDocuments(input: {
  model: string;
  characters?: CharacterEmbeddingSource[];
  factions?: FactionEmbeddingSource[];
  items?: ItemEmbeddingSource[];
  hooks?: HookEmbeddingSource[];
  relations?: RelationEmbeddingSource[];
  worldSettings?: WorldSettingEmbeddingSource[];
}): EmbeddingDocument[] {
  const documents: EmbeddingDocument[] = [];

  for (const character of input.characters ?? []) {
    documents.push({
      entityType: "character",
      entityId: character.id,
      chunkKey: `character:${character.id}:summary`,
      model: input.model,
      displayName: character.name,
      text: buildCharacterEmbeddingText(character),
    });
  }

  for (const faction of input.factions ?? []) {
    documents.push({
      entityType: "faction",
      entityId: faction.id,
      chunkKey: `faction:${faction.id}:summary`,
      model: input.model,
      displayName: faction.name,
      text: buildFactionEmbeddingText(faction),
    });
  }

  for (const item of input.items ?? []) {
    documents.push({
      entityType: "item",
      entityId: item.id,
      chunkKey: `item:${item.id}:summary`,
      model: input.model,
      displayName: item.name,
      text: buildItemEmbeddingText(item),
    });
  }

  for (const hook of input.hooks ?? []) {
    documents.push({
      entityType: "hook",
      entityId: hook.id,
      chunkKey: `hook:${hook.id}:summary`,
      model: input.model,
      displayName: hook.title,
      text: buildHookEmbeddingText(hook),
    });
  }

  for (const relation of input.relations ?? []) {
    documents.push({
      entityType: "relation",
      entityId: relation.id,
      chunkKey: `relation:${relation.id}:summary`,
      model: input.model,
      displayName: `${relation.sourceName} -> ${relation.targetName}`,
      text: buildRelationEmbeddingText(relation),
      relationEndpoints: buildRelationEndpoints(relation),
      relationMetadata: buildRelationMetadata(relation),
    });
  }

  for (const setting of input.worldSettings ?? []) {
    documents.push({
      entityType: "world_setting",
      entityId: setting.id,
      chunkKey: `world_setting:${setting.id}:summary`,
      model: input.model,
      displayName: setting.title,
      text: buildWorldSettingEmbeddingText(setting),
    });
  }

  return documents;
}

function buildRelationEndpoints(relation: RelationEmbeddingSource): RelationEmbeddingEndpoint[] | undefined {
  const endpoints = [
    relation.sourceType && relation.sourceId
      ? { entityType: relation.sourceType, entityId: relation.sourceId, displayName: relation.sourceName }
      : null,
    relation.targetType && relation.targetId
      ? { entityType: relation.targetType, entityId: relation.targetId, displayName: relation.targetName }
      : null,
  ].filter(Boolean) as RelationEmbeddingEndpoint[];

  return endpoints.length > 0 ? endpoints : undefined;
}

function buildRelationMetadata(relation: RelationEmbeddingSource): RelationEmbeddingMetadata | undefined {
  if (!relation.relationType) {
    return undefined;
  }

  return {
    relationType: relation.relationType,
    status: relation.status ?? undefined,
    description: relation.description ?? undefined,
    appendNotes: relation.notes ?? undefined,
  };
}
