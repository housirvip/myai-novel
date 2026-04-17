export type EmbeddingEntityType =
  | "character"
  | "faction"
  | "item"
  | "relation"
  | "hook"
  | "world_setting"
  | "chapter";

export interface EmbeddingDocument {
  entityType: EmbeddingEntityType;
  entityId: number;
  chunkKey: string;
  model: string;
  displayName: string;
  text: string;
  relationEndpoints?: Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
  relationMetadata?: {
    relationType: string;
    status?: string;
    description?: string;
    appendNotes?: string;
  };
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
  relationEndpoints?: Array<{
    entityType: "character" | "faction";
    entityId: number;
    displayName: string;
  }>;
  relationMetadata?: {
    relationType: string;
    status?: string;
    description?: string;
    appendNotes?: string;
  };
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
