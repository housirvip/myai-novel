import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type RelationRow = Selectable<DatabaseSchema["relations"]>;
export type NewRelationRow = Insertable<DatabaseSchema["relations"]>;
export type RelationUpdateRow = Updateable<DatabaseSchema["relations"]>;

export class RelationRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewRelationRow): Promise<RelationRow> {
    return this.db
      .insertInto("relations")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<RelationRow[]> {
    let query = this.db
      .selectFrom("relations")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<RelationRow | undefined> {
    return this.db.selectFrom("relations").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async findByComposite(input: {
    bookId: number;
    sourceType: string;
    sourceId: number;
    targetType: string;
    targetId: number;
    relationType: string;
  }): Promise<RelationRow | undefined> {
    return this.db
      .selectFrom("relations")
      .selectAll()
      .where("book_id", "=", input.bookId)
      .where("source_type", "=", input.sourceType)
      .where("source_id", "=", input.sourceId)
      .where("target_type", "=", input.targetType)
      .where("target_id", "=", input.targetId)
      .where("relation_type", "=", input.relationType)
      .executeTakeFirst();
  }

  async updateById(id: number, input: RelationUpdateRow): Promise<RelationRow | undefined> {
    return this.db
      .updateTable("relations")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("relations").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
