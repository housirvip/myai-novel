import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type StoryEventRow = Selectable<DatabaseSchema["story_events"]>;
export type NewStoryEventRow = Insertable<DatabaseSchema["story_events"]>;
export type StoryEventUpdateRow = Updateable<DatabaseSchema["story_events"]>;

export class StoryEventRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewStoryEventRow): Promise<StoryEventRow> {
    return insertAndFetchById({ db: this.db, table: "story_events", values: input });
  }

  async getById(id: number): Promise<StoryEventRow | undefined> {
    return this.db.selectFrom("story_events").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async listByBookId(bookId: number, limit = 100, status?: string): Promise<StoryEventRow[]> {
    let query = this.db.selectFrom("story_events").selectAll().where("book_id", "=", bookId);
    if (status) {
      query = query.where("status", "=", status);
    }
    return query.orderBy("id", "asc").limit(limit).execute();
  }

  async updateById(id: number, input: StoryEventUpdateRow): Promise<StoryEventRow | undefined> {
    return updateAndFetchById({ db: this.db, table: "story_events", id, values: input });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("story_events").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
