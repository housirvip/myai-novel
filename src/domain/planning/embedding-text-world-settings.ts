interface WorldSettingEmbeddingSource {
  id: number;
  title: string;
  category?: string | null;
  content?: string | null;
  notes?: string | null;
}

export function buildWorldSettingEmbeddingText(setting: WorldSettingEmbeddingSource): string {
  return compactLines([
    `设定：${setting.title}`,
    setting.category ? `类别：${setting.category}` : null,
    setting.content ? `规则摘要：${setting.content}` : null,
    setting.notes ? `连续性风险：${setting.notes}` : null,
  ]);
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
