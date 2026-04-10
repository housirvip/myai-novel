import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type FactionRow = Selectable<DatabaseSchema["factions"]>;
export type NewFactionRow = Insertable<DatabaseSchema["factions"]>;
export type FactionUpdateRow = Updateable<DatabaseSchema["factions"]>;

export class FactionRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewFactionRow): Promise<FactionRow> {
    return this.db
      .insertInto("factions")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<FactionRow[]> {
    let query = this.db
      .selectFrom("factions")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<FactionRow | undefined> {
    return this.db.selectFrom("factions").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async updateById(id: number, input: FactionUpdateRow): Promise<FactionRow | undefined> {
    return this.db
      .updateTable("factions")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("factions").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
