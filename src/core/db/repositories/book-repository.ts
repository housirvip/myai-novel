import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type BookRow = Selectable<DatabaseSchema["books"]>;
export type NewBookRow = Insertable<DatabaseSchema["books"]>;
export type BookUpdateRow = Updateable<DatabaseSchema["books"]>;

export class BookRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewBookRow): Promise<BookRow> {
    const result = await this.db
      .insertInto("books")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async list(limit = 50): Promise<BookRow[]> {
    return this.db
      .selectFrom("books")
      .selectAll()
      .orderBy("id", "asc")
      .limit(limit)
      .execute();
  }

  async getById(id: number): Promise<BookRow | undefined> {
    return this.db.selectFrom("books").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async updateById(id: number, input: BookUpdateRow): Promise<BookRow | undefined> {
    const result = await this.db
      .updateTable("books")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return result;
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("books").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

