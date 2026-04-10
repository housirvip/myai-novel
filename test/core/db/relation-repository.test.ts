import assert from "node:assert/strict";
import test from "node:test";

import { migrateToLatest } from "../../../src/core/db/migrations/initial.js";
import { BookRepository } from "../../../src/core/db/repositories/book-repository.js";
import { RelationRepository } from "../../../src/core/db/repositories/relation-repository.js";
import { createInMemoryDb, createNoopLogger } from "../../helpers/sqlite.js";

test("relation repository supports create/get/find/update/delete", async () => {
  const db = createInMemoryDb();
  const logger = createNoopLogger() as never;
  const timestamp = "2026-04-10T15:00:00.000Z";

  try {
    await migrateToLatest(db, logger);

    const book = await new BookRepository(db).create({
      title: "测试书",
      summary: null,
      target_chapter_count: 10,
      current_chapter_count: 0,
      status: "planning",
      metadata: null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const repository = new RelationRepository(db);
    const created = await repository.create({
      book_id: book.id,
      source_type: "character",
      source_id: 1,
      target_type: "faction",
      target_id: 2,
      relation_type: "member",
      intensity: 50,
      status: "active",
      description: "初始关系",
      append_notes: null,
      keywords: "[\"林夜\",\"青岳宗\"]",
      created_at: timestamp,
      updated_at: timestamp,
    });

    assert.equal(created.relation_type, "member");

    const fetched = await repository.getById(created.id);
    assert.equal(fetched?.source_id, 1);

    const composite = await repository.findByComposite({
      bookId: book.id,
      sourceType: "character",
      sourceId: 1,
      targetType: "faction",
      targetId: 2,
      relationType: "member",
    });
    assert.equal(composite?.id, created.id);

    const updated = await repository.updateById(created.id, {
      intensity: 80,
      description: "关系加强",
      updated_at: "2026-04-10T16:00:00.000Z",
    });
    assert.equal(updated?.intensity, 80);
    assert.equal(updated?.description, "关系加强");

    assert.equal(await repository.deleteById(created.id), true);
    assert.equal(await repository.getById(created.id), undefined);
  } finally {
    await db.destroy();
  }
});
