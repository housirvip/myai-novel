import { sql, type Insertable, type Kysely, type Selectable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById } from "./helpers.js";

export type ChapterReviewRow = Selectable<DatabaseSchema["chapter_reviews"]>;
export type NewChapterReviewRow = Insertable<DatabaseSchema["chapter_reviews"]>;

export class ChapterReviewRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterReviewRow): Promise<ChapterReviewRow> {
    return insertAndFetchById({
      db: this.db,
      table: "chapter_reviews",
      values: input,
    });
  }

  async getById(id: number): Promise<ChapterReviewRow | undefined> {
    return this.db
      .selectFrom("chapter_reviews")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getLatestVersionNo(chapterId: number): Promise<number> {
    const result = await this.db
      .selectFrom("chapter_reviews")
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
