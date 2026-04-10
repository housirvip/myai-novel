function isNullLiteral(value: string): boolean {
  return value.trim().toLowerCase() === "null";
}

export function parseRequiredNumber(value: string, fieldName: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${fieldName}: ${value}`);
  }

  return parsed;
}

export function parseOptionalNumber(
  value: string | undefined,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isNullLiteral(value)) {
    return null;
  }

  return parseRequiredNumber(value, fieldName);
}

export function parseOptionalText(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isNullLiteral(value)) {
    return null;
  }

  return value;
}

export function parseOptionalStringArrayText(
  value: string | undefined,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isNullLiteral(value)) {
    return null;
  }

  const trimmed = value.trim();
  const items = trimmed.startsWith("[")
    ? parseJsonArray(trimmed, fieldName).map((item) => {
        if (typeof item !== "string") {
          throw new Error(`${fieldName} must be an array of strings`);
        }

        return item.trim();
      })
    : trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return JSON.stringify(items);
}

export function parseOptionalNumberArrayText(
  value: string | undefined,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isNullLiteral(value)) {
    return null;
  }

  const trimmed = value.trim();
  const items = trimmed.startsWith("[")
    ? parseJsonArray(trimmed, fieldName).map((item) => {
        if (typeof item !== "number" || !Number.isFinite(item)) {
          throw new Error(`${fieldName} must be an array of numbers`);
        }

        return item;
      })
    : trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => parseRequiredNumber(item, fieldName));

  return JSON.stringify(items);
}

export function parseOptionalKeywordsText(
  value: string | undefined,
): string | null | undefined {
  const parsed = parseOptionalStringArrayText(value, "keywords");

  if (parsed === undefined || parsed === null) {
    return parsed;
  }

  const keywords = JSON.parse(parsed) as string[];

  for (const keyword of keywords) {
    if (keyword.length > 8) {
      throw new Error(`Keyword exceeds 8 characters: ${keyword}`);
    }
  }

  return parsed;
}

export function parseOptionalStructuredText(
  value: string | undefined,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isNullLiteral(value)) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch (error) {
      throw new Error(
        `Invalid JSON for ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return JSON.stringify(
    trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseJsonArray(value: string, fieldName: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON array`);
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid JSON array for ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
