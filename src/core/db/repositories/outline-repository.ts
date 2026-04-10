import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type OutlineRow = Selectable<DatabaseSchema["outlines"]>;
export type NewOutlineRow = Insertable<DatabaseSchema["outlines"]>;
export type OutlineUpdateRow = Updateable<DatabaseSchema["outlines"]>;

export class OutlineRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewOutlineRow): Promise<OutlineRow> {
    return this.db
      .insertInto("outlines")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50): Promise<OutlineRow[]> {
    return this.db
      .selectFrom("outlines")
      .selectAll()
      .where("book_id", "=", bookId)
      .orderBy("chapter_start_no", "asc")
      .orderBy("id", "asc")
      .limit(limit)
      .execute();
  }

  async getById(id: number): Promise<OutlineRow | undefined> {
    return this.db.selectFrom("outlines").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async updateById(id: number, input: OutlineUpdateRow): Promise<OutlineRow | undefined> {
    return this.db
      .updateTable("outlines")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("outlines").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
