import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type ItemRow = Selectable<DatabaseSchema["items"]>;
export type NewItemRow = Insertable<DatabaseSchema["items"]>;
export type ItemUpdateRow = Updateable<DatabaseSchema["items"]>;

export class ItemRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewItemRow): Promise<ItemRow> {
    return this.db
      .insertInto("items")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<ItemRow[]> {
    let query = this.db
      .selectFrom("items")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<ItemRow | undefined> {
    return this.db.selectFrom("items").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async updateById(id: number, input: ItemUpdateRow): Promise<ItemRow | undefined> {
    return this.db
      .updateTable("items")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("items").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
