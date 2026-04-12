import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type StoryHookRow = Selectable<DatabaseSchema["story_hooks"]>;
export type NewStoryHookRow = Insertable<DatabaseSchema["story_hooks"]>;
export type StoryHookUpdateRow = Updateable<DatabaseSchema["story_hooks"]>;

export class StoryHookRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewStoryHookRow): Promise<StoryHookRow> {
    return insertAndFetchById({
      db: this.db,
      table: "story_hooks",
      values: input,
    });
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<StoryHookRow[]> {
    let query = this.db
      .selectFrom("story_hooks")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<StoryHookRow | undefined> {
    return this.db
      .selectFrom("story_hooks")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async updateById(id: number, input: StoryHookUpdateRow): Promise<StoryHookRow | undefined> {
    return updateAndFetchById({
      db: this.db,
      table: "story_hooks",
      id,
      values: input,
    });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom("story_hooks")
      .where("id", "=", id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
