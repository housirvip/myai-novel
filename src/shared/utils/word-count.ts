export function estimateWordCount(content: string): number {
  return content.replace(/\s+/g, "").length;
}
