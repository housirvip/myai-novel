import { sql, type Insertable, type Kysely, type Selectable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById } from "./helpers.js";

export type ChapterFinalRow = Selectable<DatabaseSchema["chapter_finals"]>;
export type NewChapterFinalRow = Insertable<DatabaseSchema["chapter_finals"]>;

export class ChapterFinalRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterFinalRow): Promise<ChapterFinalRow> {
    return insertAndFetchById({
      db: this.db,
      table: "chapter_finals",
      values: input,
    });
  }

  async getById(id: number): Promise<ChapterFinalRow | undefined> {
    return this.db
      .selectFrom("chapter_finals")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getLatestVersionNo(chapterId: number): Promise<number> {
    const result = await this.db
      .selectFrom("chapter_finals")
      .select((expressionBuilder) =>
        sql<number>`coalesce(max(${expressionBuilder.ref("version_no")}), 0)`.as(
          "latest_version_no",
        ),
      )
      .where("chapter_id", "=", chapterId)
      .executeTakeFirstOrThrow();

    return result.latest_version_no;
  }
}
