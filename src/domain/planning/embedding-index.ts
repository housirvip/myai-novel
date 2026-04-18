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
  // embedding document 是实体到向量索引之间的中间层。
  // 这里统一生成 displayName / chunkKey / text，避免索引层直接依赖数据库字段细节。
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
    // 关系实体除了文本摘要，还额外携带端点和元数据。
    // 这样后面即使只通过 embedding 命中一条关系，也还能恢复“是谁和谁的什么关系”。
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
  // 关系端点是后续事实包、approve diff、prompt 解释链路都能复用的结构化信息，
  // 所以在建索引文档时就顺手固化下来，而不是等命中后再反向解析文本。
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
  // relationMetadata 不是为了提升搜索召回，而是为了让命中结果回流业务层时保留足够的语义上下文。
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
