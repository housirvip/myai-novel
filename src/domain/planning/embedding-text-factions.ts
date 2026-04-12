interface FactionEmbeddingSource {
  id: number;
  name: string;
  category?: string | null;
  summary?: string | null;
  core_goal?: string | null;
  status?: string | null;
  notes?: string | null;
}

export function buildFactionEmbeddingText(faction: FactionEmbeddingSource): string {
  return compactLines([
    `势力：${faction.name}`,
    faction.category ? `类型：${faction.category}` : null,
    faction.summary ? `身份摘要：${faction.summary}` : null,
    faction.core_goal ? `核心目标：${faction.core_goal}` : null,
    faction.status ? `当前态势：${faction.status}` : null,
    faction.notes ? `连续性风险：${faction.notes}` : null,
  ]);
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
