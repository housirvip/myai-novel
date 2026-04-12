interface CharacterEmbeddingSource {
  id: number;
  name: string;
  alias?: string | null;
  summary?: string | null;
  goal?: string | null;
  background?: string | null;
  personality?: string | null;
  current_location?: string | null;
  status?: string | null;
  notes?: string | null;
}

export function buildCharacterEmbeddingText(character: CharacterEmbeddingSource): string {
  return compactLines([
    `人物：${character.name}`,
    character.alias ? `别名：${character.alias}` : null,
    character.summary ? `身份摘要：${character.summary}` : null,
    character.goal ? `核心动机：${character.goal}` : null,
    buildCurrentState(character.status, character.current_location),
    character.personality ? `性格线索：${character.personality}` : null,
    character.background ? `背景摘要：${character.background}` : null,
    character.notes ? `连续性风险：${character.notes}` : null,
  ]);
}

function buildCurrentState(status?: string | null, location?: string | null): string | null {
  const parts = [status ? `状态=${status}` : null, location ? `地点=${location}` : null].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return `当前状态：${parts.join("；")}`;
}

function compactLines(lines: Array<string | null>): string {
  return lines.filter(Boolean).join("\n");
}
