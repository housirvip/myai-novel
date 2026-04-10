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
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  CUSTOM_LLM_BASE_URL: z.string().optional(),
  CUSTOM_LLM_API_KEY: z.string().optional(),
  CUSTOM_LLM_MODEL: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  LOG_DIR: path.resolve(parsedEnv.LOG_DIR),
  DB_SQLITE_PATH: path.resolve(parsedEnv.DB_SQLITE_PATH),
};

export type AppEnv = typeof env;

