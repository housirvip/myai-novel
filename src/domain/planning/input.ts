import { z } from "zod";

import { env } from "../../config/env.js";
import { parseRequiredNumber } from "../../shared/utils/cli.js";
import type { ExtractedIntentPayload, ManualEntityRefs } from "./types.js";

const keywordSchema = z.string().min(1).max(env.PLANNING_KEYWORD_MAX_LENGTH);
const retrievalCueSchema = z.string().min(1).max(32);

export const extractedIntentSchema = z.object({
  intentSummary: z.string().min(1),
  keywords: z.array(keywordSchema).max(env.PLANNING_INTENT_KEYWORD_LIMIT),
  mustInclude: z.array(z.string().min(1)).max(env.PLANNING_INTENT_MUST_INCLUDE_LIMIT).default([]),
  mustAvoid: z.array(z.string().min(1)).max(env.PLANNING_INTENT_MUST_AVOID_LIMIT).default([]),
  entityHints: z.object({
    characters: z.array(retrievalCueSchema).max(8).default([]),
    factions: z.array(retrievalCueSchema).max(8).default([]),
    items: z.array(retrievalCueSchema).max(8).default([]),
    relations: z.array(retrievalCueSchema).max(8).default([]),
    hooks: z.array(retrievalCueSchema).max(8).default([]),
    worldSettings: z.array(retrievalCueSchema).max(8).default([]),
  }).default({
    characters: [],
    factions: [],
    items: [],
    relations: [],
    hooks: [],
    worldSettings: [],
  }),
  continuityCues: z.array(retrievalCueSchema).max(10).default([]),
  settingCues: z.array(retrievalCueSchema).max(10).default([]),
  sceneCues: z.array(retrievalCueSchema).max(10).default([]),
});

export const planInputSchema = z.object({
  bookId: z.number().int().positive(),
  chapterNo: z.number().int().positive(),
  authorIntent: z.string().min(1).optional(),
  manualEntityRefs: z.object({
    characterIds: z.array(z.number().int().positive()).default([]),
    factionIds: z.array(z.number().int().positive()).default([]),
    itemIds: z.array(z.number().int().positive()).default([]),
    hookIds: z.array(z.number().int().positive()).default([]),
    relationIds: z.array(z.number().int().positive()).default([]),
    worldSettingIds: z.array(z.number().int().positive()).default([]),
  }),
});

export function parseIdList(value: string | undefined, fieldName: string): number[] {
  if (!value?.trim()) {
    return [];
  }

  const trimmed = value.trim();
  const rawItems = trimmed.startsWith("[")
    ? parseJsonNumberArray(trimmed, fieldName)
    : trimmed.split(",").map((item) => item.trim());

  return rawItems
    .filter((item) => String(item).trim().length > 0)
    .map((item) => parseRequiredNumber(String(item), fieldName));
}

export function normalizeKeywords(keywords: string[]): string[] {
  return z.array(keywordSchema).parse(
    keywords
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  );
}

export function createManualEntityRefs(input?: Partial<ManualEntityRefs>): ManualEntityRefs {
  return planInputSchema.shape.manualEntityRefs.parse({
    characterIds: input?.characterIds ?? [],
    factionIds: input?.factionIds ?? [],
    itemIds: input?.itemIds ?? [],
    hookIds: input?.hookIds ?? [],
    relationIds: input?.relationIds ?? [],
    worldSettingIds: input?.worldSettingIds ?? [],
  });
}

export function normalizeExtractedIntent(raw: unknown): ExtractedIntentPayload {
  const source = isRecord(raw) ? raw : {};

  return extractedIntentSchema.parse({
    intentSummary: normalizeScalarText(source.intentSummary),
    keywords: normalizeStringList(source.keywords),
    mustInclude: normalizeStringList(source.mustInclude),
    mustAvoid: normalizeStringList(source.mustAvoid),
    entityHints: normalizeEntityHints(source.entityHints),
    continuityCues: normalizeCueList(source.continuityCues),
    settingCues: normalizeCueList(source.settingCues),
    sceneCues: normalizeCueList(source.sceneCues),
  });
}

function parseJsonNumberArray(value: string, fieldName: string): Array<string | number> {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array`);
    }

    return parsed as Array<string | number>;
  } catch (error) {
    throw new Error(
      `Invalid JSON array for ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeEntityHints(value: unknown): ExtractedIntentPayload["entityHints"] {
  const source = isRecord(value) ? value : {};

  return {
    characters: normalizeHintList(source.characters),
    factions: normalizeHintList(source.factions),
    items: normalizeHintList(source.items),
    relations: normalizeHintList(source.relations),
    hooks: normalizeHintList(source.hooks),
    worldSettings: normalizeHintList(source.worldSettings),
  };
}

function normalizeCueList(value: unknown): string[] {
  if (typeof value === "string") {
    return normalizeStrings([value]);
  }

  if (Array.isArray(value)) {
    return normalizeStrings(value.flatMap((item) => (typeof item === "string" ? [item] : [])));
  }

  return [];
}

function normalizeHintList(value: unknown): string[] {
  return normalizeStrings(collectStringLeaves(value));
}

function normalizeStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return normalizeStrings([value]);
  }

  if (Array.isArray(value)) {
    return normalizeStrings(value.flatMap((item) => (typeof item === "string" ? [item] : [])));
  }

  return [];
}

function normalizeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeScalarText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringLeaves(item));
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => collectStringLeaves(item));
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
