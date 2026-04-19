import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type RetrievalDocumentRow = Selectable<DatabaseSchema["retrieval_documents"]>;
export type NewRetrievalDocumentRow = Insertable<DatabaseSchema["retrieval_documents"]>;
export type RetrievalDocumentUpdateRow = Updateable<DatabaseSchema["retrieval_documents"]>;

export class RetrievalDocumentRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewRetrievalDocumentRow): Promise<RetrievalDocumentRow> {
    return insertAndFetchById({ db: this.db, table: "retrieval_documents", values: input });
  }

  async getById(id: number): Promise<RetrievalDocumentRow | undefined> {
    return this.db.selectFrom("retrieval_documents").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async listByBookId(bookId: number, limit = 100, layer?: string): Promise<RetrievalDocumentRow[]> {
    let query = this.db.selectFrom("retrieval_documents").selectAll().where("book_id", "=", bookId);
    if (layer) {
      query = query.where("layer", "=", layer);
    }
    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async findByChunk(input: { bookId: number; layer: string; chunkKey: string; embeddingModel?: string }): Promise<RetrievalDocumentRow | undefined> {
    let query = this.db
      .selectFrom("retrieval_documents")
      .selectAll()
      .where("book_id", "=", input.bookId)
      .where("layer", "=", input.layer)
      .where("chunk_key", "=", input.chunkKey);

    if (input.embeddingModel) {
      query = query.where("embedding_model", "=", input.embeddingModel);
    }

    return query.executeTakeFirst();
  }

  async updateById(id: number, input: RetrievalDocumentUpdateRow): Promise<RetrievalDocumentRow | undefined> {
    return updateAndFetchById({ db: this.db, table: "retrieval_documents", id, values: input });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("retrieval_documents").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
