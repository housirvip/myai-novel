import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type RetrievalFactRow = Selectable<DatabaseSchema["retrieval_facts"]>;
export type NewRetrievalFactRow = Insertable<DatabaseSchema["retrieval_facts"]>;
export type RetrievalFactUpdateRow = Updateable<DatabaseSchema["retrieval_facts"]>;

export class RetrievalFactRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewRetrievalFactRow): Promise<RetrievalFactRow> {
    return insertAndFetchById({ db: this.db, table: "retrieval_facts", values: input });
  }

  async getById(id: number): Promise<RetrievalFactRow | undefined> {
    return this.db.selectFrom("retrieval_facts").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async listByBookId(bookId: number, limit = 100, factType?: string): Promise<RetrievalFactRow[]> {
    let query = this.db.selectFrom("retrieval_facts").selectAll().where("book_id", "=", bookId);
    if (factType) {
      query = query.where("fact_type", "=", factType);
    }
    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async findByFactKey(bookId: number, factKey: string): Promise<RetrievalFactRow | undefined> {
    return this.db
      .selectFrom("retrieval_facts")
      .selectAll()
      .where("book_id", "=", bookId)
      .where("fact_key", "=", factKey)
      .executeTakeFirst();
  }

  async updateById(id: number, input: RetrievalFactUpdateRow): Promise<RetrievalFactRow | undefined> {
    return updateAndFetchById({ db: this.db, table: "retrieval_facts", id, values: input });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("retrieval_facts").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
