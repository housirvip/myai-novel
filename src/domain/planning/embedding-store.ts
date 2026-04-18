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
    // replace 语义是“先清空这个模型+实体类型下的旧文档，再整体写入新版本”。
    // 这样 refresh 后不会残留过期 chunk，保证同一批索引文档始终来自同一轮构建。
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
  // 这里按下标把文档和向量重新拼回去，默认要求 provider 返回顺序与输入顺序一致。
  return documents.map((document, index) => ({
    ...document,
    vector: vectors[index] ?? [],
  }));
}

function buildKey(document: IndexedEmbeddingDocument): string {
  return `${document.model}:${document.entityType}:${document.chunkKey}`;
}
