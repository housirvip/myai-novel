import type { ChapterPlanRow } from "../../core/db/repositories/chapter-plan-repository.js";
import type { PlanIntentConstraints } from "../planning/types.js";

export function parseStoredJson(value: string | null): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function appendChapterNote(
  existing: string | null,
  chapterNo: number,
  note: string | null | undefined,
): string | null {
  const normalized = note?.trim();

  if (!normalized) {
    return existing;
  }

  const prefix = `[Chapter ${chapterNo}] ${normalized}`;

  if (!existing?.trim()) {
    return prefix;
  }

  return `${existing}\n${prefix}`;
}

export function dedupeNumberList(values: number[]): number[] {
  return [...new Set(values)];
}

export function parseStoredStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function readPlanIntentConstraints(plan: ChapterPlanRow): PlanIntentConstraints {
  return {
    intentSummary: plan.intent_summary,
    mustInclude: parseStoredStringArray(plan.intent_must_include),
    mustAvoid: parseStoredStringArray(plan.intent_must_avoid),
  };
}
