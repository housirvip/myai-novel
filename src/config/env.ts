import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// 用 zod 在进程启动阶段一次性完成环境变量校验与默认值填充，
// 可以把 provider、日志、planning limit 的错误尽早暴露，而不是拖到运行时某个工作流里才报错。
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
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default("myai_novel"),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
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
  PLANNING_RETRIEVAL_RERANKER: z.enum(["none", "heuristic"]).default("none"),
  PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: z.enum(["hash", "custom"]).default("hash"),
  PLANNING_RETRIEVAL_EMBEDDING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: z.enum(["basic", "hybrid"]).default("basic"),
  CUSTOM_EMBEDDING_BASE_URL: z.string().optional(),
  CUSTOM_EMBEDDING_API_KEY: z.string().optional(),
  CUSTOM_EMBEDDING_MODEL: z.string().default("custom-embedding-v1"),
  CUSTOM_EMBEDDING_PATH: z.string().default("/embeddings"),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  // 统一在配置层把相对路径转成绝对路径，避免后续 logger、db、fixture 读取时受当前工作目录影响。
  LOG_DIR: path.resolve(parsedEnv.LOG_DIR),
  DB_SQLITE_PATH: path.resolve(parsedEnv.DB_SQLITE_PATH),
  MOCK_LLM_FIXTURE_PATH: parsedEnv.MOCK_LLM_FIXTURE_PATH
    ? path.resolve(parsedEnv.MOCK_LLM_FIXTURE_PATH)
    : undefined,
};

export type AppEnv = typeof env;
