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
      await createIndexes(database);
    },
  );
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
