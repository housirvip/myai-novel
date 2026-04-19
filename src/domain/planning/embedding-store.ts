import type { Kysely, Selectable } from "kysely";

import type { DatabaseSchema } from "../../core/db/schema/database.js";
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

export class DbRetrievalDocumentEmbeddingStore implements EmbeddingStore {
  constructor(
    private readonly db: Kysely<DatabaseSchema>,
    private readonly bookId: number,
  ) {}

  async replaceDocuments(params: {
    model: string;
    entityType: EmbeddingEntityType;
    documents: IndexedEmbeddingDocument[];
  }): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await deleteEmbeddingDocuments(trx, this.bookId, { model: params.model, entityType: params.entityType });

      for (const document of params.documents) {
        const timestamp = new Date().toISOString();
        await trx
          .insertInto("retrieval_documents")
          .values({
            book_id: this.bookId,
            entity_type: document.entityType,
            entity_id: document.entityId,
            layer: "embedding",
            chunk_key: document.chunkKey,
            chapter_no: null,
            payload_json: JSON.stringify({
              vector: document.vector,
              displayName: document.displayName,
              relationEndpoints: document.relationEndpoints ?? null,
              relationMetadata: document.relationMetadata ?? null,
            }),
            text: document.text,
            embedding_model: document.model,
            embedding_vector_ref: null,
            status: "active",
            created_at: timestamp,
            updated_at: timestamp,
          })
          .executeTakeFirstOrThrow();
      }
    });
  }

  async listDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<IndexedEmbeddingDocument[]> {
    let query = this.db
      .selectFrom("retrieval_documents")
      .selectAll()
      .where("book_id", "=", this.bookId)
      .where("layer", "=", "embedding")
      .where("status", "=", "active");

    if (params?.model) {
      query = query.where("embedding_model", "=", params.model);
    }
    if (params?.entityType) {
      query = query.where("entity_type", "=", params.entityType);
    }

    const rows = await query.orderBy("id", "asc").execute();
    return rows.flatMap((row) => hydrateIndexedDocument(row));
  }

  async clearDocuments(params?: {
    model?: string;
    entityType?: EmbeddingEntityType;
  }): Promise<void> {
    await deleteEmbeddingDocuments(this.db, this.bookId, params);
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

function hydrateIndexedDocument(row: Selectable<DatabaseSchema["retrieval_documents"]>): IndexedEmbeddingDocument[] {
  if (!row.embedding_model || !row.entity_type || row.entity_id === null) {
    return [];
  }

  const payload = parseEmbeddingPayload(row.payload_json);
  if (!payload?.vector) {
    return [];
  }

  return [{
    entityType: row.entity_type as EmbeddingEntityType,
    entityId: row.entity_id,
    chunkKey: row.chunk_key,
    model: row.embedding_model,
    displayName: payload.displayName ?? row.chunk_key,
    text: row.text,
    vector: payload.vector,
    relationEndpoints: payload.relationEndpoints ?? undefined,
    relationMetadata: payload.relationMetadata ?? undefined,
  }];
}

function parseEmbeddingPayload(payloadJson: string | null): {
  vector?: number[];
  displayName?: string;
  relationEndpoints?: IndexedEmbeddingDocument["relationEndpoints"];
  relationMetadata?: IndexedEmbeddingDocument["relationMetadata"];
} | null {
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as {
      vector?: number[];
      displayName?: string;
      relationEndpoints?: IndexedEmbeddingDocument["relationEndpoints"];
      relationMetadata?: IndexedEmbeddingDocument["relationMetadata"];
    };
    return parsed;
  } catch {
    return null;
  }
}

async function deleteEmbeddingDocuments(
  db: Kysely<DatabaseSchema>,
  bookId: number,
  params?: { model?: string; entityType?: EmbeddingEntityType },
): Promise<void> {
  let query = db
    .deleteFrom("retrieval_documents")
    .where("book_id", "=", bookId)
    .where("layer", "=", "embedding");

  if (params?.model) {
    query = query.where("embedding_model", "=", params.model);
  }
  if (params?.entityType) {
    query = query.where("entity_type", "=", params.entityType);
  }

  await query.executeTakeFirst();
}
