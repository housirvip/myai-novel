import { sql, type Insertable, type Kysely, type Selectable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById } from "./helpers.js";

export type ChapterPlanRow = Selectable<DatabaseSchema["chapter_plans"]>;
export type NewChapterPlanRow = Insertable<DatabaseSchema["chapter_plans"]>;

export class ChapterPlanRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterPlanRow): Promise<ChapterPlanRow> {
    return insertAndFetchById({
      db: this.db,
      table: "chapter_plans",
      values: input,
    });
  }

  async getById(id: number): Promise<ChapterPlanRow | undefined> {
    return this.db
      .selectFrom("chapter_plans")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getLatestVersionNo(chapterId: number): Promise<number> {
    const result = await this.db
      .selectFrom("chapter_plans")
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
