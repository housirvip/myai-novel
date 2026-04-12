import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type WorldSettingRow = Selectable<DatabaseSchema["world_settings"]>;
export type NewWorldSettingRow = Insertable<DatabaseSchema["world_settings"]>;
export type WorldSettingUpdateRow = Updateable<DatabaseSchema["world_settings"]>;

export class WorldSettingRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewWorldSettingRow): Promise<WorldSettingRow> {
    return insertAndFetchById({
      db: this.db,
      table: "world_settings",
      values: input,
    });
  }

  async listByBookId(
    bookId: number,
    limit = 50,
    status?: string,
  ): Promise<WorldSettingRow[]> {
    let query = this.db
      .selectFrom("world_settings")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<WorldSettingRow | undefined> {
    return this.db
      .selectFrom("world_settings")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async updateById(
    id: number,
    input: WorldSettingUpdateRow,
  ): Promise<WorldSettingRow | undefined> {
    return updateAndFetchById({
      db: this.db,
      table: "world_settings",
      id,
      values: input,
    });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom("world_settings")
      .where("id", "=", id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
