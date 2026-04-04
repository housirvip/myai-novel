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
