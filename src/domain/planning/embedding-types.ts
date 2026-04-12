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
  text: string;
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
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
