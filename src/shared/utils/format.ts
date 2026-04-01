export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function formatList(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}: (empty)`
  }

  return `${title}:\n${items.map((item) => `- ${item}`).join('\n')}`
}
