export function parseStoredJson(value: string | null): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function appendChapterNote(
  existing: string | null,
  chapterNo: number,
  note: string | null | undefined,
): string | null {
  const normalized = note?.trim();

  if (!normalized) {
    return existing;
  }

  const prefix = `[Chapter ${chapterNo}] ${normalized}`;

  if (!existing?.trim()) {
    return prefix;
  }

  return `${existing}\n${prefix}`;
}

export function dedupeNumberList(values: number[]): number[] {
  return [...new Set(values)];
}
