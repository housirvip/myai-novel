interface WorldSettingEmbeddingSource {
  id: number;
  title: string;
  category?: string | null;
  content?: string | null;
  notes?: string | null;
}

export function buildWorldSettingEmbeddingText(setting: WorldSettingEmbeddingSource): string {
  // 世界设定这里故意从“摘要 / 边界 / 执行条件”三个角度重复同一段内容，
  // 不是为了生成漂亮文本，而是为了把规则类设定在不同语义问法下都更容易被向量命中。
  return compactLines([
    `设定：${setting.title}`,
    setting.category ? `类别：${setting.category}` : null,
    setting.content ? `规则摘要：${setting.content}` : null,
    setting.content ? `规则边界：${setting.content}` : null,
    setting.content ? `执行条件：${setting.content}` : null,
    setting.notes ? `连续性风险：${setting.notes}` : null,
  ]);
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
