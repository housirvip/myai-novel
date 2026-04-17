export type EmbeddingEntityType =
  | "character"
  | "faction"
  | "item"
  | "relation"
  | "hook"
  | "world_setting"
  | "chapter";

export interface RelationEmbeddingEndpoint {
  entityType: "character" | "faction";
  entityId: number;
  displayName: string;
}

export interface RelationEmbeddingMetadata {
  relationType: string;
  status?: string;
  description?: string;
  appendNotes?: string;
}

export interface RelationEmbeddingSource {
  id: number;
  sourceName: string;
  sourceType?: "character" | "faction";
  sourceId?: number;
  targetName: string;
  targetType?: "character" | "faction";
  targetId?: number;
  relationSummary?: string | null;
  relationType?: string | null;
  status?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface EmbeddingDocument {
  entityType: EmbeddingEntityType;
  entityId: number;
  chunkKey: string;
  model: string;
  displayName: string;
  text: string;
  relationEndpoints?: RelationEmbeddingEndpoint[];
  relationMetadata?: RelationEmbeddingMetadata;
}

export interface IndexedEmbeddingDocument extends EmbeddingDocument {
  vector: number[];
}

export interface EmbeddingMatch {
  entityType: EmbeddingEntityType;
  entityId: number;
  chunkKey: string;
  semanticScore: number;
  text: string;
  displayName: string;
  relationEndpoints?: RelationEmbeddingEndpoint[];
  relationMetadata?: RelationEmbeddingMetadata;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
