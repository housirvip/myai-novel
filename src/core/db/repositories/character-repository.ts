import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type CharacterRow = Selectable<DatabaseSchema["characters"]>;
export type NewCharacterRow = Insertable<DatabaseSchema["characters"]>;
export type CharacterUpdateRow = Updateable<DatabaseSchema["characters"]>;

export class CharacterRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewCharacterRow): Promise<CharacterRow> {
    return this.db
      .insertInto("characters")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<CharacterRow[]> {
    let query = this.db
      .selectFrom("characters")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<CharacterRow | undefined> {
    return this.db
      .selectFrom("characters")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async updateById(id: number, input: CharacterUpdateRow): Promise<CharacterRow | undefined> {
    return this.db
      .updateTable("characters")
      .set(input)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("characters").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
