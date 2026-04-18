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
  // CLI 同时接受 JSON 数组和逗号分隔文本，
  // 这样既方便脚本直传结构化参数，也方便命令行手敲简单列表。
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
  // 数字数组和字符串数组保持相同输入约定，
  // 避免不同命令参数在“支持 JSON 还是支持逗号分隔”上出现心智负担。
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

  // keyword 长度限制放在 CLI 边界尽早失败，
  // 这样用户能在命令执行入口就拿到明确报错，而不是拖到后面的 workflow / zod 校验才发现。
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

  // structured text 是一个宽容入口：
  // 传 JSON 时原样保结构；传逗号分隔时退化成字符串数组，便于命令行快速试跑。
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
