import {
  buildCharacterEmbeddingText,
  buildHookEmbeddingText,
  buildWorldSettingEmbeddingText,
} from "./embedding-text.js";
import type { EmbeddingDocument } from "./embedding-types.js";

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

interface WorldSettingEmbeddingSource {
  id: number;
  title: string;
  category?: string | null;
  content?: string | null;
  notes?: string | null;
}

export function buildEmbeddingDocuments(input: {
  model: string;
  characters?: CharacterEmbeddingSource[];
  hooks?: HookEmbeddingSource[];
  worldSettings?: WorldSettingEmbeddingSource[];
}): EmbeddingDocument[] {
  const documents: EmbeddingDocument[] = [];

  for (const character of input.characters ?? []) {
    documents.push({
      entityType: "character",
      entityId: character.id,
      chunkKey: `character:${character.id}:summary`,
      model: input.model,
      displayName: character.name,
      text: buildCharacterEmbeddingText(character),
    });
  }

  for (const hook of input.hooks ?? []) {
    documents.push({
      entityType: "hook",
      entityId: hook.id,
      chunkKey: `hook:${hook.id}:summary`,
      model: input.model,
      displayName: hook.title,
      text: buildHookEmbeddingText(hook),
    });
  }

  for (const setting of input.worldSettings ?? []) {
    documents.push({
      entityType: "world_setting",
      entityId: setting.id,
      chunkKey: `world_setting:${setting.id}:summary`,
      model: input.model,
      displayName: setting.title,
      text: buildWorldSettingEmbeddingText(setting),
    });
  }

  return documents;
}
