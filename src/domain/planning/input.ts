import { z } from "zod";

import { parseRequiredNumber } from "../../shared/utils/cli.js";
import type { ManualEntityRefs } from "./types.js";

const keywordSchema = z.string().min(1).max(8);

export const extractedIntentSchema = z.object({
  intentSummary: z.string().min(1),
  keywords: z.array(keywordSchema).max(20),
  mustInclude: z.array(z.string().min(1)).max(20).default([]),
  mustAvoid: z.array(z.string().min(1)).max(20).default([]),
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
