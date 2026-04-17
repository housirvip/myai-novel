import type { EmbeddingProvider, RelationEmbeddingSource } from "./embedding-types.js";
import type { EmbeddingStore } from "./embedding-store.js";
import { buildEmbeddingDocuments } from "./embedding-index.js";
import { buildIndexedEmbeddingDocuments } from "./embedding-store.js";

interface CharacterEmbeddingSource {
  id: number;
  name: string;
  alias?: string | null;
  summary?: string | null;
  goal?: string | null;
  background?: string | null;
  personality?: string | null;
  current_location?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface HookEmbeddingSource {
  id: number;
  title: string;
  description?: string | null;
  foreshadowing?: string | null;
  expected_payoff?: string | null;
  status?: string | null;
  target_chapter_no?: number | null;
  notes?: string | null;
}

interface FactionEmbeddingSource {
  id: number;
  name: string;
  category?: string | null;
  summary?: string | null;
  core_goal?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface ItemEmbeddingSource {
  id: number;
  name: string;
  description?: string | null;
  ability?: string | null;
  summary?: string | null;
  status?: string | null;
  ownerSummary?: string | null;
  notes?: string | null;
}

interface WorldSettingEmbeddingSource {
  id: number;
  title: string;
  category?: string | null;
  content?: string | null;
  notes?: string | null;
}

export class EmbeddingRefreshService {
  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly store: EmbeddingStore,
  ) {}

  async refresh(params: {
    model: string;
    characters?: CharacterEmbeddingSource[];
    factions?: FactionEmbeddingSource[];
    items?: ItemEmbeddingSource[];
    hooks?: HookEmbeddingSource[];
    relations?: RelationEmbeddingSource[];
    worldSettings?: WorldSettingEmbeddingSource[];
  }): Promise<void> {
    const documentsByType = groupDocumentsByType(buildEmbeddingDocuments(params));

    for (const [entityType, docs] of documentsByType.entries()) {
      const vectors = await this.provider.embedBatch(docs.map((document) => document.text));
      await this.store.replaceDocuments({
        model: params.model,
        entityType,
        documents: buildIndexedEmbeddingDocuments(docs, vectors),
      });
    }
  }

  async refreshEntityType(params: {
    model: string;
    entityType: "character" | "faction" | "item" | "hook" | "relation" | "world_setting";
    characters?: CharacterEmbeddingSource[];
    factions?: FactionEmbeddingSource[];
    items?: ItemEmbeddingSource[];
    hooks?: HookEmbeddingSource[];
    relations?: RelationEmbeddingSource[];
    worldSettings?: WorldSettingEmbeddingSource[];
  }): Promise<void> {
    const allDocuments = buildEmbeddingDocuments(params);
    const documents = allDocuments.filter((document) => document.entityType === params.entityType);
    const vectors = await this.provider.embedBatch(documents.map((document) => document.text));

    await this.store.replaceDocuments({
      model: params.model,
      entityType: params.entityType,
      documents: buildIndexedEmbeddingDocuments(documents, vectors),
    });
  }

  async clearModel(model: string): Promise<void> {
    await this.store.clearDocuments({ model });
  }
}

function groupDocumentsByType(documents: ReturnType<typeof buildEmbeddingDocuments>) {
  const groups = new Map<ReturnType<typeof buildEmbeddingDocuments>[number]["entityType"], typeof documents>();

  for (const document of documents) {
    const existing = groups.get(document.entityType) ?? [];
    existing.push(document);
    groups.set(document.entityType, existing);
  }

  return groups;
}
