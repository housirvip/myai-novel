export function formatTrace(detail: {
  source: string
  reason: string
  evidence: string[]
  evidenceSummary?: string
  before?: string
  after?: string
  previousValueSummary?: string
  nextValueSummary?: string
}): string {
  // trace 在 CLI 中统一压成单行，方便 summary 视图直接扫读 before/after 和证据来源。
  return [
    `source=${detail.source}`,
    `reason=${detail.reason}`,
    `before=${detail.previousValueSummary ?? detail.before ?? 'N/A'}`,
    `after=${detail.nextValueSummary ?? detail.after ?? 'N/A'}`,
    `evidence=${detail.evidenceSummary ?? (detail.evidence.join(' | ') || 'N/A')}`,
  ].join('；')
}

export function summarizeClosureSuggestions(closureSuggestions: {
  characters: unknown[]
  items: unknown[]
  hooks: unknown[]
  memory: unknown[]
}): { total: number; characters: number; items: number; hooks: number; memory: number } {
  // review 里的 closure suggestions 会在多个命令复用，这里先做轻量聚合，避免各处重复计数逻辑。
  return {
    total:
      closureSuggestions.characters.length +
      closureSuggestions.items.length +
      closureSuggestions.hooks.length +
      closureSuggestions.memory.length,
    characters: closureSuggestions.characters.length,
    items: closureSuggestions.items.length,
    hooks: closureSuggestions.hooks.length,
    memory: closureSuggestions.memory.length,
  }
}
