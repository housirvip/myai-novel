interface HookEmbeddingSource {
  id: number;
  title: string;
  description?: string | null;
  foreshadowing?: string | null;
  expected_payoff?: string | null;
  status?: string | null;
  target_chapter_no?: number | null;
  notes?: string | null;
}

export function buildHookEmbeddingText(hook: HookEmbeddingSource): string {
  return compactLines([
    `钩子：${hook.title}`,
    hook.description ? `摘要：${hook.description}` : null,
    hook.foreshadowing ? `铺垫：${hook.foreshadowing}` : null,
    hook.expected_payoff ? `预期兑现：${hook.expected_payoff}` : null,
    buildHookProgress(hook.status, hook.target_chapter_no),
    hook.notes ? `风险提醒：${hook.notes}` : null,
  ]);
}

function buildHookProgress(status?: string | null, targetChapterNo?: number | null): string | null {
  const parts = [status ? `状态=${status}` : null, targetChapterNo ? `目标章节=${targetChapterNo}` : null].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return `当前推进：${parts.join("；")}`;
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
