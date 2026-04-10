export function parseLooseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const target = fenced?.[1] ?? trimmed;
  return JSON.parse(target);
}
