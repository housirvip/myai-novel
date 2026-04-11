import type { RetrievedEntity } from "./types.js";

export interface RetrievalScoredRow {
  id: number;
  name?: string | null;
  title?: string | null;
  score: number;
  reason: string[];
  content: string;
}

export function rankRows(rows: RetrievalScoredRow[], limit: number): RetrievedEntity[] {
  return rows
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name ?? undefined,
      title: row.title ?? undefined,
      reason: row.reason.join("+"),
      content: row.content,
      score: row.score,
    }));
}

export function scoreEntity(input: {
  manualIds: number[];
  entityId: number;
  keywords: string[];
  textSources: Array<string | null>;
}): number {
  let score = input.manualIds.includes(input.entityId) ? 100 : 0;
  const haystack = input.textSources.filter(Boolean).join("\n").toLowerCase();

  for (const keyword of input.keywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      score += 25;
    }
  }

  return score;
}

export function buildReasons(input: {
  manualIds: number[];
  entityId: number;
  keywords: string[];
  textSources: Array<string | null>;
  extraReasons?: string[];
}): string[] {
  const reasons = [...(input.extraReasons ?? [])];

  if (input.manualIds.includes(input.entityId)) {
    reasons.push("manual_id");
  }

  const haystack = input.textSources.filter(Boolean).join("\n").toLowerCase();
  if (input.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    reasons.push("keyword_hit");
  }

  return reasons.length > 0 ? reasons : ["low_relevance"];
}

export function proximityBoost(targetChapterNo: number | null, chapterNo: number): number {
  if (!targetChapterNo) {
    return 0;
  }

  const distance = Math.abs(targetChapterNo - chapterNo);
  if (distance === 0) {
    return 40;
  }
  if (distance === 1) {
    return 25;
  }
  if (distance === 2) {
    return 10;
  }
  return 0;
}
