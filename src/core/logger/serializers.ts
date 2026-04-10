import { env } from "../../config/env.js";

export function truncateText(value: string, maxChars = env.LOG_LLM_CONTENT_MAX_CHARS): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...(truncated)`;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
  };
}

export function serializeLlmContent(content: string): Record<string, unknown> {
  return {
    contentLoggingEnabled: env.LOG_LLM_CONTENT_ENABLED,
    contentLength: content.length,
    content: env.LOG_LLM_CONTENT_ENABLED ? truncateText(content) : undefined,
  };
}

