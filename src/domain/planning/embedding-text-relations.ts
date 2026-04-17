import type { RelationEmbeddingSource } from "./embedding-types.js";

export function buildRelationEmbeddingText(relation: RelationEmbeddingSource): string {
  return compactLines([
    `关系：${relation.sourceName} -> ${relation.targetName}`,
    relation.relationType ? `关系类型：${relation.relationType}` : null,
    relation.relationSummary ? `关系摘要：${relation.relationSummary}` : null,
    relation.status ? `当前张力：${relation.status}` : null,
    relation.description ? `近期变化：${relation.description}` : null,
    relation.notes ? `风险提醒：${relation.notes}` : null,
  ]);
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
