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
  // 势力文本除了名称和目标，还会对“宗门”追加规则执行语义，
  // 这是为了让 embedding 更容易把宗门类势力与制度、登记、内外门语境对齐。
  return compactLines([
    `势力：${faction.name}`,
    faction.category ? `类型：${faction.category}` : null,
    faction.summary ? `身份摘要：${faction.summary}` : null,
    faction.core_goal ? `核心目标：${faction.core_goal}` : null,
    faction.category === "宗门" ? `规则执行：负责宗门制度、外门、内门、登记等秩序执行` : null,
    faction.status ? `当前态势：${faction.status}` : null,
    faction.notes ? `连续性风险：${faction.notes}` : null,
  ]);
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
