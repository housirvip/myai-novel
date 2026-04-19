import { env } from "../../config/env.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type { AppLogger } from "../../core/logger/index.js";
import { DeterministicHashEmbeddingProvider } from "./embedding-provider.js";
import { CustomRemoteEmbeddingProvider } from "./embedding-provider-custom.js";
import { EmbeddingRefreshService } from "./embedding-refresh.js";
import { HybridEmbeddingSearcher } from "./embedding-searcher-hybrid.js";
import { InMemoryEmbeddingSearcher } from "./embedding-searcher-memory.js";
import { DbRetrievalDocumentEmbeddingStore } from "./embedding-store.js";
import { RetrievalQueryService } from "./retrieval-service.js";
import type { EmbeddingProvider, RelationEmbeddingSource } from "./embedding-types.js";

const DEFAULT_EMBEDDING_MODEL = "planning-retrieval-deterministic-v1";

export async function createPlanningRetrievalService(
  logger: AppLogger,
  db: import("kysely").Kysely<DatabaseSchema>,
  input: { bookId: number },
): Promise<RetrievalQueryService> {
  if (env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER === "none") {
    return new RetrievalQueryService(logger);
  }

  const provider = createEmbeddingProvider();
  const store = new DbRetrievalDocumentEmbeddingStore(db, input.bookId);
  const refresh = new EmbeddingRefreshService(provider, store);
  const [characters, factions, items, hooks, relations, worldSettings] = await Promise.all([
    db
      .selectFrom("characters")
      .select([
        "id",
        "name",
        "alias",
        "background",
        "personality",
        "current_location",
        "status",
        "goal",
        "append_notes",
      ])
      .where("book_id", "=", input.bookId)
      .where("status", "in", ["alive", "missing", "unknown"])
      .execute(),
    db
      .selectFrom("factions")
      .select(["id", "name", "category", "core_goal", "description", "status", "append_notes"])
      .where("book_id", "=", input.bookId)
      .where("status", "=", "active")
      .execute(),
    db
      .selectFrom("items")
      .select(["id", "name", "category", "description", "rarity", "status", "owner_type", "owner_id", "append_notes"])
      .where("book_id", "=", input.bookId)
      .execute(),
    db
      .selectFrom("story_hooks")
      .select(["id", "title", "description", "status", "target_chapter_no", "append_notes"])
      .where("book_id", "=", input.bookId)
      .where("status", "in", ["open", "progressing"])
      .execute(),
    loadRelationEmbeddingRows(db, input.bookId),
    db
      .selectFrom("world_settings")
      .select(["id", "title", "category", "content", "append_notes"])
      .where("book_id", "=", input.bookId)
      .where("status", "=", "active")
      .execute(),
  ]);

  await refresh.refresh({
    model: DEFAULT_EMBEDDING_MODEL,
    characters: characters.map((row) => ({
      id: row.id,
      name: row.name,
      alias: row.alias,
      background: row.background,
      personality: row.personality,
      current_location: row.current_location,
      status: row.status,
      goal: row.goal,
      notes: row.append_notes,
    })),
    factions: factions.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      summary: row.description,
      core_goal: row.core_goal,
      status: row.status,
      notes: row.append_notes,
    })),
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.category,
      description: row.description,
      ability: row.rarity,
      status: row.status,
      ownerSummary: row.owner_id !== null ? `${row.owner_type}:${row.owner_id}` : row.owner_type,
      notes: row.append_notes,
    })),
    hooks: hooks.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      target_chapter_no: row.target_chapter_no,
      notes: row.append_notes,
    })),
    relations,
    worldSettings: worldSettings.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      content: row.content,
      notes: row.append_notes,
    })),
  });

  const indexedDocuments = await store.listDocuments({ model: DEFAULT_EMBEDDING_MODEL });
  const searcher = env.PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE === "hybrid"
    ? new HybridEmbeddingSearcher(provider)
    : new InMemoryEmbeddingSearcher(provider);

  searcher.loadIndexedDocuments(indexedDocuments);

  return new RetrievalQueryService(logger, {
    embeddingSearcher: searcher,
    embeddingSearchMode: env.PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE,
  });
}

function createEmbeddingProvider(): EmbeddingProvider {
  switch (env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER) {
    case "none":
      throw new Error("Embedding provider 'none' should not construct an embedding provider");
    case "custom":
      return new CustomRemoteEmbeddingProvider();
    case "hash":
    default:
      return new DeterministicHashEmbeddingProvider();
  }
}

async function loadRelationEmbeddingRows(
  db: import("kysely").Kysely<DatabaseSchema>,
  bookId: number,
): Promise<RelationEmbeddingSource[]> {
  const rows = await db.selectFrom("relations").selectAll().where("book_id", "=", bookId).execute();
  const characterIds = rows
    .flatMap((row) => [row.source_type === "character" ? row.source_id : null, row.target_type === "character" ? row.target_id : null])
    .filter((value): value is number => value !== null);
  const factionIds = rows
    .flatMap((row) => [row.source_type === "faction" ? row.source_id : null, row.target_type === "faction" ? row.target_id : null])
    .filter((value): value is number => value !== null);
  const [characterRows, factionRows] = await Promise.all([
    characterIds.length > 0
      ? db.selectFrom("characters").select(["id", "name"]).where("id", "in", [...new Set(characterIds)]).execute()
      : Promise.resolve([]),
    factionIds.length > 0
      ? db.selectFrom("factions").select(["id", "name"]).where("id", "in", [...new Set(factionIds)]).execute()
      : Promise.resolve([]),
  ]);

  const characterNameMap = new Map(characterRows.map((row) => [row.id, row.name]));
  const factionNameMap = new Map(factionRows.map((row) => [row.id, row.name]));

  return rows.map((row) => {
    const sourceName = resolveRelationEndpointName(row.source_type, row.source_id, characterNameMap, factionNameMap);
    const targetName = resolveRelationEndpointName(row.target_type, row.target_id, characterNameMap, factionNameMap);
    return {
      id: row.id,
      sourceName,
      sourceType: row.source_type === "character" || row.source_type === "faction" ? row.source_type : undefined,
      sourceId: row.source_type === "character" || row.source_type === "faction" ? row.source_id : undefined,
      targetName,
      targetType: row.target_type === "character" || row.target_type === "faction" ? row.target_type : undefined,
      targetId: row.target_type === "character" || row.target_type === "faction" ? row.target_id : undefined,
      relationSummary: row.description,
      relationType: row.relation_type,
      status: row.status,
      description: row.description,
      notes: row.append_notes,
    };
  });
}

function resolveRelationEndpointName(
  entityType: string,
  entityId: number,
  characterNameMap: Map<number, string>,
  factionNameMap: Map<number, string>,
): string {
  if (entityType === "character") {
    return characterNameMap.get(entityId) ?? `character:${entityId}`;
  }
  if (entityType === "faction") {
    return factionNameMap.get(entityId) ?? `faction:${entityId}`;
  }
  return `${entityType}:${entityId}`;
}
