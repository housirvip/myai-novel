import type { EmbeddingDocument, EmbeddingEntityType, IndexedEmbeddingDocument } from "./embedding-types.js";

export interface EmbeddingStore {
  replaceDocuments(params: {
    model: string;
    entityType: EmbeddingEntityType;
    documents: IndexedEmbeddingDocument[];
  }): Promise<void>;
  listDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<IndexedEmbeddingDocument[]>;
  clearDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<void>;
}

export class InMemoryEmbeddingStore implements EmbeddingStore {
  private readonly documents = new Map<string, IndexedEmbeddingDocument>();

  async replaceDocuments(params: {
    model: string;
    entityType: EmbeddingEntityType;
    documents: IndexedEmbeddingDocument[];
  }): Promise<void> {
    await this.clearDocuments({ model: params.model, entityType: params.entityType });

    for (const document of params.documents) {
      this.documents.set(buildKey(document), document);
    }
  }

  async listDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<IndexedEmbeddingDocument[]> {
    return Array.from(this.documents.values()).filter((document) => {
      if (params?.model && document.model !== params.model) {
        return false;
      }
      if (params?.entityType && document.entityType !== params.entityType) {
        return false;
      }
      return true;
    });
  }

  async clearDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<void> {
    for (const [key, document] of this.documents.entries()) {
      if (params?.model && document.model !== params.model) {
        continue;
      }
      if (params?.entityType && document.entityType !== params.entityType) {
        continue;
      }
      this.documents.delete(key);
    }
  }
}

export function buildIndexedEmbeddingDocuments(
  documents: EmbeddingDocument[],
  vectors: number[][],
): IndexedEmbeddingDocument[] {
  return documents.map((document, index) => ({
    ...document,
    vector: vectors[index] ?? [],
  }));
}

function buildKey(document: IndexedEmbeddingDocument): string {
  return `${document.model}:${document.entityType}:${document.chunkKey}`;
}
