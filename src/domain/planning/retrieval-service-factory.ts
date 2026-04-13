import { env } from "../../config/env.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type { AppLogger } from "../../core/logger/index.js";
import { DeterministicHashEmbeddingProvider } from "./embedding-provider.js";
import { EmbeddingRefreshService } from "./embedding-refresh.js";
import { HybridEmbeddingSearcher } from "./embedding-searcher-hybrid.js";
import { InMemoryEmbeddingSearcher } from "./embedding-searcher-memory.js";
import { InMemoryEmbeddingStore } from "./embedding-store.js";
import { RetrievalQueryService } from "./retrieval-service.js";

const DEFAULT_EMBEDDING_MODEL = "planning-retrieval-deterministic-v1";

export async function createPlanningRetrievalService(
  logger: AppLogger,
  db: import("kysely").Kysely<DatabaseSchema>,
  input: { bookId: number },
): Promise<RetrievalQueryService> {
  if (!env.PLANNING_RETRIEVAL_EMBEDDING_ENABLED) {
    return new RetrievalQueryService(logger);
  }

  const provider = new DeterministicHashEmbeddingProvider();
  const store = new InMemoryEmbeddingStore();
  const refresh = new EmbeddingRefreshService(provider, store);
  const [characters, hooks, worldSettings] = await Promise.all([
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
      .selectFrom("story_hooks")
      .select(["id", "title", "description", "status", "target_chapter_no", "append_notes"])
      .where("book_id", "=", input.bookId)
      .where("status", "in", ["open", "progressing"])
      .execute(),
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
    hooks: hooks.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      target_chapter_no: row.target_chapter_no,
      notes: row.append_notes,
    })),
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
