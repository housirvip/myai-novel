import assert from "node:assert/strict";
import test from "node:test";

import { migrateToLatest } from "../../../src/core/db/migrations/initial.js";
import { BookRepository } from "../../../src/core/db/repositories/book-repository.js";
import { ChapterRepository } from "../../../src/core/db/repositories/chapter-repository.js";
import { ChapterSegmentRepository } from "../../../src/core/db/repositories/chapter-segment-repository.js";
import { RetrievalDocumentRepository } from "../../../src/core/db/repositories/retrieval-document-repository.js";
import { RetrievalFactRepository } from "../../../src/core/db/repositories/retrieval-fact-repository.js";
import { StoryEventRepository } from "../../../src/core/db/repositories/story-event-repository.js";
import { createInMemoryDb, createNoopLogger } from "../../helpers/sqlite.js";

test("phase2 retrieval repositories support core CRUD flows", async () => {
  const db = createInMemoryDb();
  const logger = createNoopLogger() as never;
  const timestamp = "2026-04-10T15:00:00.000Z";

  try {
    await migrateToLatest(db, logger);

    const book = await new BookRepository(db).create({
      title: "长篇测试书",
      summary: null,
      target_chapter_count: 3000,
      current_chapter_count: 120,
      status: "writing",
      metadata: null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const chapter = await new ChapterRepository(db).create({
      book_id: book.id,
      chapter_no: 120,
      title: "第一百二十章",
      summary: "旧案进入回收阶段。",
      word_count: 3200,
      status: "approved",
      current_plan_id: null,
      current_draft_id: null,
      current_review_id: null,
      current_final_id: null,
      actual_character_ids: null,
      actual_faction_ids: null,
      actual_item_ids: null,
      actual_hook_ids: null,
      actual_world_setting_ids: null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const documentRepository = new RetrievalDocumentRepository(db);
    const factRepository = new RetrievalFactRepository(db);
    const eventRepository = new StoryEventRepository(db);
    const segmentRepository = new ChapterSegmentRepository(db);

    const document = await documentRepository.create({
      book_id: book.id,
      entity_type: "character",
      entity_id: 101,
      layer: "fact",
      chunk_key: "character:101:state:goal",
      chapter_no: 120,
      payload_json: JSON.stringify({ field: "goal" }),
      text: "当前目标：查清黑铁令旧案。",
      embedding_model: null,
      embedding_vector_ref: null,
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    });

    assert.equal(document.layer, "fact");
    assert.equal((await documentRepository.findByChunk({ bookId: book.id, layer: "fact", chunkKey: "character:101:state:goal" }))?.id, document.id);
    assert.equal((await documentRepository.findByChunk({ bookId: book.id, layer: "fact", chunkKey: "character:101:state:goal", embeddingModel: "embed-v1" }))?.id, undefined);

    const fact = await factRepository.create({
      book_id: book.id,
      chapter_no: 120,
      entity_type: "character",
      entity_id: 101,
      event_id: null,
      fact_type: "goal_state",
      fact_key: "character:101:goal_state:120",
      fact_text: "林夜当前目标仍是追查黑铁令旧案。",
      payload_json: JSON.stringify({ importance: "high" }),
      importance: 90,
      risk_level: 85,
      effective_from_chapter_no: 120,
      effective_to_chapter_no: null,
      superseded_by_fact_id: null,
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    });

    assert.equal((await factRepository.findByFactKey(book.id, "character:101:goal_state:120"))?.id, fact.id);

    const event = await eventRepository.create({
      book_id: book.id,
      chapter_id: chapter.id,
      chapter_no: chapter.chapter_no,
      event_type: "investigation",
      title: "档案库旧案追查",
      summary: "林夜开始规避封存律调查旧案。",
      participant_entity_refs: JSON.stringify([{ entityType: "character", entityId: 101 }]),
      location_label: "执事档案库",
      trigger_text: "旧案线索再次浮现",
      outcome_text: "确认旧案并未终结",
      unresolved_impact: "仍需找到黑铁副令来源",
      hook_refs: JSON.stringify([101]),
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    });

    assert.equal((await eventRepository.getById(event.id))?.title, "档案库旧案追查");

    const segment = await segmentRepository.create({
      book_id: book.id,
      chapter_id: chapter.id,
      chapter_no: chapter.chapter_no,
      segment_index: 0,
      source_type: "chapter_summary",
      text: "林夜意识到旧案与黑铁副令之间存在未解关联。",
      summary: "旧案关联浮现",
      event_refs: JSON.stringify([event.id]),
      metadata: JSON.stringify({ spoilerSafe: false }),
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
    });

    assert.equal((await segmentRepository.findByChapterSegment(chapter.id, 0))?.id, segment.id);

    const updatedDocument = await documentRepository.updateById(document.id, {
      text: "当前目标：查清黑铁令旧案，并锁定黑铁副令去向。",
      updated_at: "2026-04-10T16:00:00.000Z",
    });
    assert.match(updatedDocument?.text ?? "", /黑铁副令/);

    assert.equal(await segmentRepository.deleteById(segment.id), true);
    assert.equal(await eventRepository.deleteById(event.id), true);
    assert.equal(await factRepository.deleteById(fact.id), true);
    assert.equal(await documentRepository.deleteById(document.id), true);
  } finally {
    await db.destroy();
  }
});
