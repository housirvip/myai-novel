import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  LOG_DIR: z.string().default("./logs"),
  LOG_LLM_CONTENT_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  LOG_LLM_CONTENT_MAX_CHARS: z.coerce.number().int().positive().default(4000),
  DB_CLIENT: z.enum(["sqlite", "mysql"]).default("sqlite"),
  DB_SQLITE_PATH: z.string().default("./data/novel.db"),
  LLM_PROVIDER: z.enum(["mock", "openai", "anthropic", "custom"]).default("mock"),
  MOCK_LLM_MODE: z.enum(["echo", "fixture", "json"]).default("echo"),
  MOCK_LLM_RESPONSE_TEXT: z.string().default("Mock response"),
  MOCK_LLM_FIXTURE_PATH: z.string().optional(),
  MOCK_LLM_MODEL: z.string().default("mock-v1"),
  LLM_DEFAULT_MAX_TOKENS: z.coerce.number().int().positive().default(2048),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  CUSTOM_LLM_BASE_URL: z.string().optional(),
  CUSTOM_LLM_API_KEY: z.string().optional(),
  CUSTOM_LLM_MODEL: z.string().default("custom-default"),
  PLANNING_KEYWORD_MAX_LENGTH: z.coerce.number().int().positive().default(8),
  PLANNING_INTENT_KEYWORD_LIMIT: z.coerce.number().int().positive().default(20),
  PLANNING_INTENT_MUST_INCLUDE_LIMIT: z.coerce.number().int().positive().default(20),
  PLANNING_INTENT_MUST_AVOID_LIMIT: z.coerce.number().int().positive().default(20),
  PLANNING_RETRIEVAL_OUTLINE_LIMIT: z.coerce.number().int().positive().default(3),
  PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT: z.coerce.number().int().positive().default(3),
  PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER: z.coerce.number().int().positive().default(5),
  PLANNING_RETRIEVAL_HOOK_LIMIT: z.coerce.number().int().positive().default(10),
  PLANNING_RETRIEVAL_CHARACTER_LIMIT: z.coerce.number().int().positive().default(12),
  PLANNING_RETRIEVAL_FACTION_LIMIT: z.coerce.number().int().positive().default(8),
  PLANNING_RETRIEVAL_ITEM_LIMIT: z.coerce.number().int().positive().default(8),
  PLANNING_RETRIEVAL_RELATION_LIMIT: z.coerce.number().int().positive().default(10),
  PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT: z.coerce.number().int().positive().default(8),
  PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT: z.coerce.number().int().positive().default(200),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  LOG_DIR: path.resolve(parsedEnv.LOG_DIR),
  DB_SQLITE_PATH: path.resolve(parsedEnv.DB_SQLITE_PATH),
  MOCK_LLM_FIXTURE_PATH: parsedEnv.MOCK_LLM_FIXTURE_PATH
    ? path.resolve(parsedEnv.MOCK_LLM_FIXTURE_PATH)
    : undefined,
};

export type AppEnv = typeof env;
