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
  // 物品文本会把用途、剧情关联、持有状态放在一起，
  // 因为很多关键物品的相关性来自“谁持有它、它在当前局势里起什么作用”，不只是名称匹配。
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
