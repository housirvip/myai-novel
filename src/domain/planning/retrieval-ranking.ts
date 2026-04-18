import type { RetrievedEntity } from "./types.js";

export interface RetrievalScoredRow {
  id: number;
  name?: string | null;
  title?: string | null;
  score: number;
  reason: string[];
  content: string;
}

interface WeightedTextSource {
  text: string | null;
  weight: number;
}

export function rankRows(rows: RetrievalScoredRow[], limit: number): RetrievedEntity[] {
  // rankRows 的职责只是把粗分结果裁成候选实体列表，
  // 这里不会再做业务分桶；真正的 hardConstraints / priorityContext 会在后面单独处理。
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
  textSources?: Array<string | null>;
  weightedTextSources?: WeightedTextSource[];
}): number {
  // manual id 是最高优先级的硬信号，所以先给一个明显的基础分。
  // 后面的关键词命中是在这个基线上继续叠加，而不是和手工指定抢同一层级。
  let score = input.manualIds.includes(input.entityId) ? 100 : 0;

  if (input.weightedTextSources && input.weightedTextSources.length > 0) {
    // weightedTextSources 用于表达“同样命中关键词，但命中名字、目标、位置的价值并不一样”。
    for (const keyword of input.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      for (const source of input.weightedTextSources) {
        if (source.text?.toLowerCase().includes(normalizedKeyword)) {
          score += source.weight;
        }
      }
    }
    return score;
  }

  const haystack = (input.textSources ?? []).filter(Boolean).join("\n").toLowerCase();
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
  textSources?: Array<string | null>;
  weightedTextSources?: WeightedTextSource[];
  extraReasons?: string[];
}): string[] {
  // reasons 不是完整 explain trace，只保留后续流程真正会消费的几类命中标签。
  // 这样既能支撑 hardConstraints / priorityContext 判断，又不会把上游打分细节过度泄露到下游。
  const reasons = [...(input.extraReasons ?? [])];

  if (input.manualIds.includes(input.entityId)) {
    reasons.push("manual_id");
  }

  const haystack = input.weightedTextSources && input.weightedTextSources.length > 0
    ? input.weightedTextSources.map((item) => item.text).filter(Boolean).join("\n").toLowerCase()
    : (input.textSources ?? []).filter(Boolean).join("\n").toLowerCase();

  if (input.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    reasons.push("keyword_hit");
  }

  return reasons.length > 0 ? reasons : ["low_relevance"];
}

export function proximityBoost(targetChapterNo: number | null, chapterNo: number): number {
  // 钩子离当前章节越近，越应该优先进入上下文前排。
  // 这里给的是章节距离启发式，不代表“到了目标章就一定必须回收”。
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
