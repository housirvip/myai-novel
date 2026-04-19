import { sql, type Kysely } from "kysely";

import { env } from "../../../config/env.js";
import type { AppLogger } from "../../logger/index.js";
import { withTimingLog } from "../../logger/index.js";
import type { DatabaseSchema } from "../schema/database.js";

const TYPE_STATUS = "varchar(32)";
const TYPE_ENTITY_TYPE = "varchar(32)";
const TYPE_CATEGORY = "varchar(64)";
const TYPE_NAME = "varchar(255)";
const TYPE_RELATION = "varchar(64)";

export async function migrateToLatest(
  database: Kysely<DatabaseSchema>,
  logger: AppLogger,
): Promise<void> {
  await withTimingLog(
    logger,
    {
      event: "db.migrate",
      migration: "initial_schema_v1",
    },
    async () => {
      await createBooksTable(database);
      await createOutlinesTable(database);
      await createWorldSettingsTable(database);
      await createCharactersTable(database);
      await createFactionsTable(database);
      await createRelationsTable(database);
      await createItemsTable(database);
      await createStoryHooksTable(database);
      await createChaptersTable(database);
      await createChapterPlansTable(database);
      await ensureChapterPlanColumns(database);
      await createChapterDraftsTable(database);
      await createChapterReviewsTable(database);
      await createChapterFinalsTable(database);
      await createRetrievalDocumentsTable(database);
      await createRetrievalFactsTable(database);
      await createStoryEventsTable(database);
      await createChapterSegmentsTable(database);
      await ensureMysqlCompatibleColumnTypes(database);
      await rebuildMysqlCompatibleIndexes(database);
      await createIndexes(database);
    },
  );
}

async function ensureMysqlCompatibleColumnTypes(database: Kysely<DatabaseSchema>): Promise<void> {
  if (env.DB_CLIENT !== "mysql") {
    return;
  }

  const alterTargets: Array<{ table: string; column: string; definition: string }> = [
    { table: "books", column: "status", definition: `${TYPE_STATUS} NOT NULL DEFAULT 'planning'` },
    { table: "outlines", column: "outline_level", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "outlines", column: "title", definition: `${TYPE_NAME} NOT NULL` },
    { table: "world_settings", column: "title", definition: `${TYPE_NAME} NOT NULL` },
    { table: "world_settings", column: "category", definition: `${TYPE_CATEGORY} NOT NULL` },
    { table: "world_settings", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "characters", column: "name", definition: `${TYPE_NAME} NOT NULL` },
    { table: "characters", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "factions", column: "name", definition: `${TYPE_NAME} NOT NULL` },
    { table: "factions", column: "category", definition: TYPE_CATEGORY },
    { table: "factions", column: "status", definition: TYPE_STATUS },
    { table: "relations", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "relations", column: "target_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "relations", column: "relation_type", definition: `${TYPE_RELATION} NOT NULL` },
    { table: "relations", column: "status", definition: TYPE_STATUS },
    { table: "items", column: "name", definition: `${TYPE_NAME} NOT NULL` },
    { table: "items", column: "category", definition: TYPE_CATEGORY },
    { table: "items", column: "owner_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "items", column: "rarity", definition: TYPE_STATUS },
    { table: "items", column: "status", definition: TYPE_STATUS },
    { table: "story_hooks", column: "title", definition: `${TYPE_NAME} NOT NULL` },
    { table: "story_hooks", column: "hook_type", definition: TYPE_RELATION },
    { table: "story_hooks", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "story_hooks", column: "importance", definition: TYPE_STATUS },
    { table: "chapters", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "chapter_plans", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "chapter_plans", column: "intent_source", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "chapter_plans", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "chapter_drafts", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "chapter_drafts", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "chapter_reviews", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "chapter_reviews", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "chapter_finals", column: "status", definition: `${TYPE_STATUS} NOT NULL` },
    { table: "chapter_finals", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "retrieval_documents", column: "entity_type", definition: TYPE_ENTITY_TYPE },
    { table: "retrieval_documents", column: "layer", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "retrieval_documents", column: "chunk_key", definition: `${TYPE_NAME} NOT NULL` },
    { table: "retrieval_documents", column: "status", definition: `${TYPE_STATUS} NOT NULL DEFAULT 'active'` },
    { table: "retrieval_facts", column: "entity_type", definition: TYPE_ENTITY_TYPE },
    { table: "retrieval_facts", column: "fact_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "retrieval_facts", column: "fact_key", definition: `${TYPE_NAME} NOT NULL` },
    { table: "retrieval_facts", column: "status", definition: `${TYPE_STATUS} NOT NULL DEFAULT 'active'` },
    { table: "story_events", column: "event_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "story_events", column: "title", definition: `${TYPE_NAME} NOT NULL` },
    { table: "story_events", column: "status", definition: `${TYPE_STATUS} NOT NULL DEFAULT 'active'` },
    { table: "chapter_segments", column: "source_type", definition: `${TYPE_ENTITY_TYPE} NOT NULL` },
    { table: "chapter_segments", column: "status", definition: `${TYPE_STATUS} NOT NULL DEFAULT 'active'` },
  ];

  for (const target of alterTargets) {
    await sql.raw(`ALTER TABLE ${target.table} MODIFY COLUMN ${target.column} ${target.definition}`).execute(database);
  }
}

async function rebuildMysqlCompatibleIndexes(database: Kysely<DatabaseSchema>): Promise<void> {
  if (env.DB_CLIENT !== "mysql") {
    return;
  }

  const targets = [
    ["world_settings", "idx_world_settings_book_category"],
    ["world_settings", "idx_world_settings_book_status"],
    ["characters", "idx_characters_book_name"],
    ["characters", "idx_characters_book_status"],
    ["factions", "idx_factions_book_name"],
    ["factions", "idx_factions_book_status"],
    ["relations", "idx_relations_book_source"],
    ["relations", "idx_relations_book_target"],
    ["items", "idx_items_book_owner"],
    ["items", "idx_items_book_name"],
    ["story_hooks", "idx_story_hooks_book_status"],
    ["chapters", "idx_chapters_book_status"],
    ["chapter_plans", "idx_chapter_plans_book_status"],
    ["chapter_drafts", "idx_chapter_drafts_book_status"],
    ["chapter_reviews", "idx_chapter_reviews_book_status"],
    ["chapter_finals", "idx_chapter_finals_book_status"],
    ["retrieval_documents", "idx_retrieval_documents_book_layer"],
    ["retrieval_documents", "idx_retrieval_documents_book_entity"],
    ["retrieval_documents", "idx_retrieval_documents_book_chapter"],
    ["retrieval_facts", "idx_retrieval_facts_book_fact_type"],
    ["retrieval_facts", "idx_retrieval_facts_book_entity"],
    ["story_events", "idx_story_events_book_chapter"],
    ["story_events", "idx_story_events_book_status"],
    ["chapter_segments", "idx_chapter_segments_book_chapter"],
  ] as const;

  for (const [tableName, indexName] of targets) {
    const existingIndex = await sql<{ index_present: number }>`
      select 1 as index_present
      from information_schema.statistics
      where table_schema = database()
        and table_name = ${tableName}
        and index_name = ${indexName}
      limit 1
    `.execute(database);

    if (existingIndex.rows.length > 0) {
      await sql.raw(`DROP INDEX ${indexName} ON ${tableName}`).execute(database);
    }
  }
}

async function createBooksTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("books")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("title", "text", (column) => column.notNull())
    .addColumn("summary", "text")
    .addColumn("target_chapter_count", "integer")
    .addColumn("current_chapter_count", "integer", (column) =>
      column.notNull().defaultTo(0),
    )
    .addColumn("status", TYPE_STATUS, (column) => column.notNull().defaultTo("planning"))
    .addColumn("metadata", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createOutlinesTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("outlines")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("volume_no", "integer")
    .addColumn("volume_title", "text")
    .addColumn("chapter_start_no", "integer")
    .addColumn("chapter_end_no", "integer")
    .addColumn("outline_level", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("title", TYPE_NAME, (column) => column.notNull())
    .addColumn("story_core", "text")
    .addColumn("main_plot", "text")
    .addColumn("sub_plot", "text")
    .addColumn("foreshadowing", "text")
    .addColumn("expected_payoff", "text")
    .addColumn("notes", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createWorldSettingsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("world_settings")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("title", TYPE_NAME, (column) => column.notNull())
    .addColumn("category", TYPE_CATEGORY, (column) => column.notNull())
    .addColumn("content", "text", (column) => column.notNull())
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createCharactersTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("characters")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("name", TYPE_NAME, (column) => column.notNull())
    .addColumn("alias", "text")
    .addColumn("gender", "text")
    .addColumn("age", "integer")
    .addColumn("personality", "text")
    .addColumn("background", "text")
    .addColumn("current_location", "text")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("professions", "text")
    .addColumn("levels", "text")
    .addColumn("currencies", "text")
    .addColumn("abilities", "text")
    .addColumn("goal", "text")
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createFactionsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("factions")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("name", TYPE_NAME, (column) => column.notNull())
    .addColumn("category", TYPE_CATEGORY)
    .addColumn("core_goal", "text")
    .addColumn("description", "text")
    .addColumn("leader_character_id", "integer")
    .addColumn("headquarter", "text")
    .addColumn("status", TYPE_STATUS)
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createRelationsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("relations")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("source_id", "integer", (column) => column.notNull())
    .addColumn("target_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("target_id", "integer", (column) => column.notNull())
    .addColumn("relation_type", TYPE_RELATION, (column) => column.notNull())
    .addColumn("intensity", "integer")
    .addColumn("status", TYPE_STATUS)
    .addColumn("description", "text")
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createItemsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("items")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("name", TYPE_NAME, (column) => column.notNull())
    .addColumn("category", TYPE_CATEGORY)
    .addColumn("description", "text")
    .addColumn("owner_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("owner_id", "integer")
    .addColumn("rarity", TYPE_STATUS)
    .addColumn("status", TYPE_STATUS)
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createStoryHooksTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("story_hooks")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("title", TYPE_NAME, (column) => column.notNull())
    .addColumn("hook_type", TYPE_RELATION)
    .addColumn("description", "text")
    .addColumn("source_chapter_no", "integer")
    .addColumn("target_chapter_no", "integer")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("importance", TYPE_STATUS)
    .addColumn("append_notes", "text")
    .addColumn("keywords", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

async function createChaptersTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapters")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("title", "text")
    .addColumn("summary", "text")
    .addColumn("word_count", "integer")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("current_plan_id", "integer")
    .addColumn("current_draft_id", "integer")
    .addColumn("current_review_id", "integer")
    .addColumn("current_final_id", "integer")
    .addColumn("actual_character_ids", "text")
    .addColumn("actual_faction_ids", "text")
    .addColumn("actual_item_ids", "text")
    .addColumn("actual_hook_ids", "text")
    .addColumn("actual_world_setting_ids", "text")
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint("uniq_chapters_book_chapter_no", ["book_id", "chapter_no"])
    .execute();
}

async function createChapterPlansTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapter_plans")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("chapter_id", "integer", (column) =>
      column.notNull().references("chapters.id").onDelete("cascade"),
    )
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("version_no", "integer", (column) => column.notNull())
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("author_intent", "text")
    .addColumn("intent_source", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("intent_summary", "text")
    .addColumn("intent_keywords", "text")
    .addColumn("intent_must_include", "text")
    .addColumn("intent_must_avoid", "text")
    .addColumn("manual_entity_refs", "text")
    .addColumn("retrieved_context", "text")
    .addColumn("content", "text", (column) => column.notNull())
    .addColumn("model", "text")
    .addColumn("provider", "text")
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint("uniq_chapter_plans_chapter_version", ["chapter_id", "version_no"])
    .execute();
}

async function ensureChapterPlanColumns(database: Kysely<DatabaseSchema>): Promise<void> {
  await addColumnIfMissing(database, "chapter_plans", "intent_summary", "text");
  await addColumnIfMissing(database, "chapter_plans", "intent_must_include", "text");
  await addColumnIfMissing(database, "chapter_plans", "intent_must_avoid", "text");
}

async function createChapterDraftsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapter_drafts")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("chapter_id", "integer", (column) =>
      column.notNull().references("chapters.id").onDelete("cascade"),
    )
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("version_no", "integer", (column) => column.notNull())
    .addColumn("based_on_plan_id", "integer")
    .addColumn("based_on_draft_id", "integer")
    .addColumn("based_on_review_id", "integer")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("content", "text", (column) => column.notNull())
    .addColumn("summary", "text")
    .addColumn("word_count", "integer")
    .addColumn("model", "text")
    .addColumn("provider", "text")
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint("uniq_chapter_drafts_chapter_version", ["chapter_id", "version_no"])
    .execute();
}

async function createChapterReviewsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapter_reviews")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("chapter_id", "integer", (column) =>
      column.notNull().references("chapters.id").onDelete("cascade"),
    )
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("draft_id", "integer", (column) =>
      column.notNull().references("chapter_drafts.id").onDelete("cascade"),
    )
    .addColumn("version_no", "integer", (column) => column.notNull())
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("summary", "text")
    .addColumn("issues", "text")
    .addColumn("risks", "text")
    .addColumn("continuity_checks", "text")
    .addColumn("repair_suggestions", "text")
    .addColumn("raw_result", "text", (column) => column.notNull())
    .addColumn("model", "text")
    .addColumn("provider", "text")
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint("uniq_chapter_reviews_chapter_version", ["chapter_id", "version_no"])
    .execute();
}

async function createChapterFinalsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapter_finals")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) =>
      column.notNull().references("books.id").onDelete("cascade"),
    )
    .addColumn("chapter_id", "integer", (column) =>
      column.notNull().references("chapters.id").onDelete("cascade"),
    )
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("version_no", "integer", (column) => column.notNull())
    .addColumn("based_on_draft_id", "integer")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull())
    .addColumn("content", "text", (column) => column.notNull())
    .addColumn("summary", "text")
    .addColumn("word_count", "integer")
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("created_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updated_at", "text", (column) =>
      column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint("uniq_chapter_finals_chapter_version", ["chapter_id", "version_no"])
    .execute();
}

async function createRetrievalDocumentsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("retrieval_documents")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) => column.notNull().references("books.id").onDelete("cascade"))
    .addColumn("entity_type", TYPE_ENTITY_TYPE)
    .addColumn("entity_id", "integer")
    .addColumn("layer", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("chunk_key", TYPE_NAME, (column) => column.notNull())
    .addColumn("chapter_no", "integer")
    .addColumn("payload_json", "text")
    .addColumn("text", "text", (column) => column.notNull())
    .addColumn("embedding_model", "text")
    .addColumn("embedding_vector_ref", "text")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull().defaultTo("active"))
    .addColumn("created_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint("uniq_retrieval_documents_book_layer_model_chunk", ["book_id", "layer", "embedding_model", "chunk_key"])
    .execute();
}

async function createRetrievalFactsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("retrieval_facts")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) => column.notNull().references("books.id").onDelete("cascade"))
    .addColumn("chapter_no", "integer")
    .addColumn("entity_type", TYPE_ENTITY_TYPE)
    .addColumn("entity_id", "integer")
    .addColumn("event_id", "integer")
    .addColumn("fact_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("fact_key", TYPE_NAME, (column) => column.notNull())
    .addColumn("fact_text", "text", (column) => column.notNull())
    .addColumn("payload_json", "text")
    .addColumn("importance", "integer")
    .addColumn("risk_level", "integer")
    .addColumn("effective_from_chapter_no", "integer")
    .addColumn("effective_to_chapter_no", "integer")
    .addColumn("superseded_by_fact_id", "integer")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull().defaultTo("active"))
    .addColumn("created_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint("uniq_retrieval_facts_book_fact_key", ["book_id", "fact_key"])
    .execute();
}

async function createStoryEventsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("story_events")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) => column.notNull().references("books.id").onDelete("cascade"))
    .addColumn("chapter_id", "integer", (column) => column.references("chapters.id").onDelete("set null"))
    .addColumn("chapter_no", "integer")
    .addColumn("event_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("title", TYPE_NAME, (column) => column.notNull())
    .addColumn("summary", "text", (column) => column.notNull())
    .addColumn("participant_entity_refs", "text")
    .addColumn("location_label", "text")
    .addColumn("trigger_text", "text")
    .addColumn("outcome_text", "text")
    .addColumn("unresolved_impact", "text")
    .addColumn("hook_refs", "text")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull().defaultTo("active"))
    .addColumn("created_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

async function createChapterSegmentsTable(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createTable("chapter_segments")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey().autoIncrement())
    .addColumn("book_id", "integer", (column) => column.notNull().references("books.id").onDelete("cascade"))
    .addColumn("chapter_id", "integer", (column) => column.notNull().references("chapters.id").onDelete("cascade"))
    .addColumn("chapter_no", "integer", (column) => column.notNull())
    .addColumn("segment_index", "integer", (column) => column.notNull())
    .addColumn("source_type", TYPE_ENTITY_TYPE, (column) => column.notNull())
    .addColumn("text", "text", (column) => column.notNull())
    .addColumn("summary", "text")
    .addColumn("event_refs", "text")
    .addColumn("metadata", "text")
    .addColumn("status", TYPE_STATUS, (column) => column.notNull().defaultTo("active"))
    .addColumn("created_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (column) => column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint("uniq_chapter_segments_chapter_segment_index", ["chapter_id", "segment_index"])
    .execute();
}

async function createIndexes(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.schema
    .createIndex("idx_books_status")
    .ifNotExists()
    .on("books")
    .column("status")
    .execute();

  await database.schema
    .createIndex("idx_outlines_book_id")
    .ifNotExists()
    .on("outlines")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_outlines_book_range")
    .ifNotExists()
    .on("outlines")
    .columns(["book_id", "chapter_start_no", "chapter_end_no"])
    .execute();

  await database.schema
    .createIndex("idx_world_settings_book_id")
    .ifNotExists()
    .on("world_settings")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_world_settings_book_category")
    .ifNotExists()
    .on("world_settings")
    .columns(["book_id", "category"])
    .execute();

  await database.schema
    .createIndex("idx_world_settings_book_status")
    .ifNotExists()
    .on("world_settings")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_characters_book_id")
    .ifNotExists()
    .on("characters")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_characters_book_name")
    .ifNotExists()
    .on("characters")
    .columns(["book_id", "name"])
    .execute();

  await database.schema
    .createIndex("idx_characters_book_status")
    .ifNotExists()
    .on("characters")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_factions_book_id")
    .ifNotExists()
    .on("factions")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_factions_book_name")
    .ifNotExists()
    .on("factions")
    .columns(["book_id", "name"])
    .execute();

  await database.schema
    .createIndex("idx_factions_book_status")
    .ifNotExists()
    .on("factions")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_relations_book_id")
    .ifNotExists()
    .on("relations")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_relations_book_source")
    .ifNotExists()
    .on("relations")
    .columns(["book_id", "source_type", "source_id"])
    .execute();

  await database.schema
    .createIndex("idx_relations_book_target")
    .ifNotExists()
    .on("relations")
    .columns(["book_id", "target_type", "target_id"])
    .execute();

  await database.schema
    .createIndex("idx_items_book_id")
    .ifNotExists()
    .on("items")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_items_book_owner")
    .ifNotExists()
    .on("items")
    .columns(["book_id", "owner_type", "owner_id"])
    .execute();

  await database.schema
    .createIndex("idx_items_book_name")
    .ifNotExists()
    .on("items")
    .columns(["book_id", "name"])
    .execute();

  await database.schema
    .createIndex("idx_story_hooks_book_id")
    .ifNotExists()
    .on("story_hooks")
    .column("book_id")
    .execute();

  await database.schema
    .createIndex("idx_story_hooks_book_status")
    .ifNotExists()
    .on("story_hooks")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_story_hooks_book_source")
    .ifNotExists()
    .on("story_hooks")
    .columns(["book_id", "source_chapter_no"])
    .execute();

  await database.schema
    .createIndex("idx_chapters_book_status")
    .ifNotExists()
    .on("chapters")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_plans_book_chapter_id")
    .ifNotExists()
    .on("chapter_plans")
    .columns(["book_id", "chapter_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_plans_book_chapter")
    .ifNotExists()
    .on("chapter_plans")
    .columns(["book_id", "chapter_no"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_plans_book_status")
    .ifNotExists()
    .on("chapter_plans")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_drafts_book_chapter_id")
    .ifNotExists()
    .on("chapter_drafts")
    .columns(["book_id", "chapter_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_drafts_book_plan_id")
    .ifNotExists()
    .on("chapter_drafts")
    .columns(["book_id", "based_on_plan_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_drafts_book_prev_draft_id")
    .ifNotExists()
    .on("chapter_drafts")
    .columns(["book_id", "based_on_draft_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_drafts_book_review_id")
    .ifNotExists()
    .on("chapter_drafts")
    .columns(["book_id", "based_on_review_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_drafts_book_status")
    .ifNotExists()
    .on("chapter_drafts")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_reviews_book_chapter_id")
    .ifNotExists()
    .on("chapter_reviews")
    .columns(["book_id", "chapter_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_reviews_book_draft_id")
    .ifNotExists()
    .on("chapter_reviews")
    .columns(["book_id", "draft_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_reviews_book_status")
    .ifNotExists()
    .on("chapter_reviews")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_finals_book_chapter_id")
    .ifNotExists()
    .on("chapter_finals")
    .columns(["book_id", "chapter_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_finals_book_draft_id")
    .ifNotExists()
    .on("chapter_finals")
    .columns(["book_id", "based_on_draft_id"])
    .execute();

  await database.schema
    .createIndex("idx_chapter_finals_book_status")
    .ifNotExists()
    .on("chapter_finals")
    .columns(["book_id", "status"])
    .execute();

  await database.schema
    .createIndex("idx_retrieval_documents_book_layer")
    .ifNotExists()
    .on("retrieval_documents")
    .columns(mysqlCompatibleColumns("book_id", "layer"))
    .execute();

  await database.schema
    .createIndex("idx_retrieval_documents_book_layer_model")
    .ifNotExists()
    .on("retrieval_documents")
    .columns(mysqlCompatibleColumns("book_id", "layer", "embedding_model"))
    .execute();

  await database.schema
    .createIndex("idx_retrieval_documents_book_entity")
    .ifNotExists()
    .on("retrieval_documents")
    .columns(mysqlCompatibleColumns("book_id", "entity_type", "entity_id"))
    .execute();

  await database.schema
    .createIndex("idx_retrieval_documents_book_chapter")
    .ifNotExists()
    .on("retrieval_documents")
    .columns(mysqlCompatibleColumns("book_id", "chapter_no"))
    .execute();

  await database.schema
    .createIndex("idx_retrieval_facts_book_fact_type")
    .ifNotExists()
    .on("retrieval_facts")
    .columns(mysqlCompatibleColumns("book_id", "fact_type"))
    .execute();

  await database.schema
    .createIndex("idx_retrieval_facts_book_entity")
    .ifNotExists()
    .on("retrieval_facts")
    .columns(mysqlCompatibleColumns("book_id", "entity_type", "entity_id"))
    .execute();

  await database.schema
    .createIndex("idx_story_events_book_chapter")
    .ifNotExists()
    .on("story_events")
    .columns(mysqlCompatibleColumns("book_id", "chapter_no"))
    .execute();

  await database.schema
    .createIndex("idx_story_events_book_status")
    .ifNotExists()
    .on("story_events")
    .columns(mysqlCompatibleColumns("book_id", "status"))
    .execute();

  await database.schema
    .createIndex("idx_chapter_segments_book_chapter")
    .ifNotExists()
    .on("chapter_segments")
    .columns(mysqlCompatibleColumns("book_id", "chapter_id", "segment_index"))
    .execute();
}

function mysqlCompatibleColumns(...columns: string[]): string[] {
  if (env.DB_CLIENT !== "mysql") {
    return columns;
  }

  // 只有仍然保留为长文本类型的列，才在 MySQL 下回退到安全的整数列索引。
  // 短状态/类型/名称字段已经改成 varchar，可继续保留原组合索引。
  const safeColumns = columns.filter(
    (column) =>
      column.endsWith("_id") ||
      column.endsWith("_no") ||
      column === "id" ||
      column === "book_id" ||
      column === "chapter_id" ||
      column === "draft_id" ||
      column === "based_on_plan_id" ||
      column === "based_on_draft_id" ||
      column === "based_on_review_id",
  );

  return safeColumns.length > 0 ? safeColumns : [columns[0] as string];
}

async function addColumnIfMissing(
  database: Kysely<DatabaseSchema>,
  tableName: string,
  columnName: string,
  columnType: string,
): Promise<void> {
  try {
    await sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`).execute(database);
  } catch (error) {
    if (isDuplicateColumnError(error, columnName)) {
      return;
    }

    throw error;
  }
}

function isDuplicateColumnError(error: unknown, columnName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.includes(`duplicate column name: ${columnName}`)) {
    return true;
  }

  if (env.DB_CLIENT === "mysql") {
    return error.message.includes("Duplicate column name") || error.message.includes("ER_DUP_FIELDNAME");
  }

  return false;
}
