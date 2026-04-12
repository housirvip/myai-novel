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

export function buildItemEmbeddingText(item: ItemEmbeddingSource): string {
  return compactLines([
    `物品：${item.name}`,
    item.summary ? `用途：${item.summary}` : null,
    item.description ? `剧情关联：${item.description}` : null,
    item.ability ? `关键能力：${item.ability}` : null,
    buildCurrentState(item.status, item.ownerSummary),
    item.notes ? `连续性风险：${item.notes}` : null,
  ]);
}

function buildCurrentState(status?: string | null, ownerSummary?: string | null): string | null {
  const parts = [status ? `状态=${status}` : null, ownerSummary ? `持有=${ownerSummary}` : null].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return `当前状态：${parts.join("；")}`;
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
