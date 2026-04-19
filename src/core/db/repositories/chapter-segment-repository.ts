import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";
import { insertAndFetchById, updateAndFetchById } from "./helpers.js";

export type ChapterSegmentRow = Selectable<DatabaseSchema["chapter_segments"]>;
export type NewChapterSegmentRow = Insertable<DatabaseSchema["chapter_segments"]>;
export type ChapterSegmentUpdateRow = Updateable<DatabaseSchema["chapter_segments"]>;

export class ChapterSegmentRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterSegmentRow): Promise<ChapterSegmentRow> {
    return insertAndFetchById({ db: this.db, table: "chapter_segments", values: input });
  }

  async getById(id: number): Promise<ChapterSegmentRow | undefined> {
    return this.db.selectFrom("chapter_segments").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async listByChapterId(chapterId: number, limit = 100): Promise<ChapterSegmentRow[]> {
    return this.db
      .selectFrom("chapter_segments")
      .selectAll()
      .where("chapter_id", "=", chapterId)
      .orderBy("segment_index", "asc")
      .limit(limit)
      .execute();
  }

  async findByChapterSegment(chapterId: number, segmentIndex: number): Promise<ChapterSegmentRow | undefined> {
    return this.db
      .selectFrom("chapter_segments")
      .selectAll()
      .where("chapter_id", "=", chapterId)
      .where("segment_index", "=", segmentIndex)
      .executeTakeFirst();
  }

  async updateById(id: number, input: ChapterSegmentUpdateRow): Promise<ChapterSegmentRow | undefined> {
    return updateAndFetchById({ db: this.db, table: "chapter_segments", id, values: input });
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.db.deleteFrom("chapter_segments").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
