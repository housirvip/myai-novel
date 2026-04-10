import { sql, type Insertable, type Kysely, type Selectable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type ChapterDraftRow = Selectable<DatabaseSchema["chapter_drafts"]>;
export type NewChapterDraftRow = Insertable<DatabaseSchema["chapter_drafts"]>;

export class ChapterDraftRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterDraftRow): Promise<ChapterDraftRow> {
    return this.db
      .insertInto("chapter_drafts")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async getById(id: number): Promise<ChapterDraftRow | undefined> {
    return this.db
      .selectFrom("chapter_drafts")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getLatestVersionNo(chapterId: number): Promise<number> {
    const result = await this.db
      .selectFrom("chapter_drafts")
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
