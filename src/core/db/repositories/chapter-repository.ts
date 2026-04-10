import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

import type { DatabaseSchema } from "../schema/database.js";

export type ChapterRow = Selectable<DatabaseSchema["chapters"]>;
export type NewChapterRow = Insertable<DatabaseSchema["chapters"]>;
export type ChapterUpdateRow = Updateable<DatabaseSchema["chapters"]>;

export class ChapterRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async create(input: NewChapterRow): Promise<ChapterRow> {
    return this.db
      .insertInto("chapters")
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listByBookId(bookId: number, limit = 50, status?: string): Promise<ChapterRow[]> {
    let query = this.db
      .selectFrom("chapters")
      .selectAll()
      .where("book_id", "=", bookId);

    if (status) {
      query = query.where("status", "=", status);
    }

    return query.orderBy("chapter_no", "asc").limit(limit).execute();
  }

  async getById(id: number): Promise<ChapterRow | undefined> {
    return this.db.selectFrom("chapters").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async getByBookAndChapterNo(
    bookId: number,
    chapterNo: number,
  ): Promise<ChapterRow | undefined> {
    return this.db
      .selectFrom("chapters")
      .selectAll()
      .where("book_id", "=", bookId)
      .where("chapter_no", "=", chapterNo)
      .executeTakeFirst();
  }

  async updateByBookAndChapterNo(
    bookId: number,
    chapterNo: number,
    input: ChapterUpdateRow,
  ): Promise<ChapterRow | undefined> {
    return this.db
      .updateTable("chapters")
      .set(input)
      .where("book_id", "=", bookId)
      .where("chapter_no", "=", chapterNo)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteByBookAndChapterNo(bookId: number, chapterNo: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom("chapters")
      .where("book_id", "=", bookId)
      .where("chapter_no", "=", chapterNo)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }
}
