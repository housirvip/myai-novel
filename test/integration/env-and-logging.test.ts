import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runInlineModule } from "../helpers/cli.js";

test("env config resolves paths and keeps defaults", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-"));
  const env = createTestEnv(tempDir, {
    LOG_DIR: "./tmp-logs",
    DB_SQLITE_PATH: "./tmp-db/novel.sqlite",
    PLANNING_RETRIEVAL_CHARACTER_LIMIT: "9",
    PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT: "1500",
    PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT: "8",
    PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC: "32",
    PLANNING_RETRIEVAL_RERANKER: "heuristic",
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "hash",
    PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE: "hybrid",
  });

  const result = await runInlineModule<{
    logDir: string;
    sqlitePath: string;
    provider: string;
    planningCharacterLimit: number;
    llmDefaultMaxTokens: number;
    planningReranker: string;
    planningEmbeddingProvider: string;
    planningEmbeddingSearchMode: string;
    embeddingMinScore: number;
    promptPlanBudget: number;
    entityScanLimit: number;
    recentChapterLimit: number;
    embeddingLimitBasic: number;
  }>(
    [
      "import { env } from './src/config/env.ts';",
      "console.log(JSON.stringify({",
      "  logDir: env.LOG_DIR,",
      "  sqlitePath: env.DB_SQLITE_PATH,",
        "  provider: env.LLM_PROVIDER,",
        "  planningCharacterLimit: env.PLANNING_RETRIEVAL_CHARACTER_LIMIT,",
        "  llmDefaultMaxTokens: env.LLM_DEFAULT_MAX_TOKENS,",
        "  planningReranker: env.PLANNING_RETRIEVAL_RERANKER,",
        "  planningEmbeddingProvider: env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER,",
        "  planningEmbeddingSearchMode: env.PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE,",
        "  embeddingMinScore: env.PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE,",
        "  promptPlanBudget: env.PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET,",
        "  entityScanLimit: env.PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT,",
        "  recentChapterLimit: env.PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT,",
        "  embeddingLimitBasic: env.PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC,",
        "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.provider, "mock");
  assert.equal(result.planningCharacterLimit, 9);
  assert.equal(result.llmDefaultMaxTokens, 2048);
  assert.equal(result.planningReranker, "heuristic");
  assert.equal(result.planningEmbeddingProvider, "hash");
  assert.equal(result.planningEmbeddingSearchMode, "hybrid");
  assert.equal(result.embeddingMinScore, 0.64);
  assert.equal(result.promptPlanBudget, 5200);
  assert.equal(result.entityScanLimit, 1500);
  assert.equal(result.recentChapterLimit, 8);
  assert.equal(result.embeddingLimitBasic, 32);
  assert.match(result.logDir, /tmp-logs$/);
  assert.match(result.sqlitePath, /tmp-db\/novel\.sqlite$/);
});

test("env config resolves mysql settings", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-mysql-"));
  const env = createTestEnv(tempDir, {
    DB_CLIENT: "mysql",
    DB_HOST: "db.internal",
    DB_PORT: "3307",
    DB_NAME: "novel_v2",
    DB_USER: "writer",
    DB_PASSWORD: "secret",
    DB_POOL_MAX: "12",
  });

  const result = await runInlineModule<{
    client: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMax: number;
  }>(
    [
      "import { env } from './src/config/env.ts';",
      "console.log(JSON.stringify({",
      "  client: env.DB_CLIENT,",
      "  host: env.DB_HOST,",
      "  port: env.DB_PORT,",
      "  name: env.DB_NAME,",
      "  user: env.DB_USER,",
      "  password: env.DB_PASSWORD,",
      "  poolMax: env.DB_POOL_MAX,",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.client, "mysql");
  assert.equal(result.host, "db.internal");
  assert.equal(result.port, 3307);
  assert.equal(result.name, "novel_v2");
  assert.equal(result.user, "writer");
  assert.equal(result.password, "secret");
  assert.equal(result.poolMax, 12);
});

test("env config requires custom embedding base url and api key when provider is custom", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-embedding-custom-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "custom",
    CUSTOM_EMBEDDING_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    CUSTOM_EMBEDDING_API_KEY: "embed-test-key",
    CUSTOM_EMBEDDING_MODEL: "text-embedding-v4",
  });

  const result = await runInlineModule<{
    provider: string;
    baseUrl: string;
    apiKey: string;
  }>(
    [
      "import { env } from './src/config/env.ts';",
      "console.log(JSON.stringify({",
      "  provider: env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER,",
      "  baseUrl: env.CUSTOM_EMBEDDING_BASE_URL,",
      "  apiKey: env.CUSTOM_EMBEDDING_API_KEY,",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.provider, "custom");
  assert.equal(result.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.equal(result.apiKey, "embed-test-key");
});

test("env config fails fast when custom embedding provider is missing api key", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-embedding-missing-key-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "custom",
    CUSTOM_EMBEDDING_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    CUSTOM_EMBEDDING_API_KEY: "",
  });

  await assert.rejects(
    runInlineModule(
      [
        "import './src/config/env.ts';",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CUSTOM_EMBEDDING_API_KEY/);
      assert.match(error.message, /PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom/);
      return true;
    },
  );
});

test("env config fails fast when custom embedding provider is missing base url", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-embedding-missing-url-"));
  const env = createTestEnv(tempDir, {
    PLANNING_RETRIEVAL_EMBEDDING_PROVIDER: "custom",
    CUSTOM_EMBEDDING_BASE_URL: "",
    CUSTOM_EMBEDDING_API_KEY: "embed-test-key",
  });

  await assert.rejects(
    runInlineModule(
      [
        "import './src/config/env.ts';",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CUSTOM_EMBEDDING_BASE_URL/);
      assert.match(error.message, /PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom/);
      return true;
    },
  );
});

test("env config fails fast when llm provider openai is missing api key", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-openai-missing-key-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "",
  });

  await assert.rejects(
    runInlineModule(
      [
        "import './src/config/env.ts';",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /OPENAI_API_KEY/);
      assert.match(error.message, /LLM_PROVIDER=openai/);
      return true;
    },
  );
});

test("env config fails fast when llm provider anthropic is missing api key", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-anthropic-missing-key-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "anthropic",
    ANTHROPIC_API_KEY: "",
  });

  await assert.rejects(
    runInlineModule(
      [
        "import './src/config/env.ts';",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ANTHROPIC_API_KEY/);
      assert.match(error.message, /LLM_PROVIDER=anthropic/);
      return true;
    },
  );
});

test("env config fails fast when llm provider custom is missing base url", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-env-custom-missing-url-"));
  const env = createTestEnv(tempDir, {
    LLM_PROVIDER: "custom",
    CUSTOM_LLM_BASE_URL: "",
    CUSTOM_LLM_API_KEY: "test-key",
  });

  await assert.rejects(
    runInlineModule(
      [
        "import './src/config/env.ts';",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CUSTOM_LLM_BASE_URL/);
      assert.match(error.message, /LLM_PROVIDER=custom/);
      return true;
    },
  );
});

test("database manager creates mysql client and destroys pool", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-mysql-client-"));
  const env = createTestEnv(tempDir, {
    DB_CLIENT: "mysql",
    DB_HOST: "mysql.test",
    DB_PORT: "3308",
    DB_NAME: "myai_novel_test",
    DB_USER: "tester",
    DB_PASSWORD: "pw",
    DB_POOL_MAX: "7",
  });

  const result = await runInlineModule<{
    constructorName: string;
    host: string;
    port: number;
    database: string;
    user: string;
    connectionLimit: number;
  }>(
    [
      "const mysql = await import('mysql2');",
      "const mysqlModule = mysql.default ?? mysql;",
      "const originalCreatePool = mysqlModule.createPool;",
      "let capturedConfig = null;",
      "mysqlModule.createPool = (config) => {",
      "  capturedConfig = config;",
      "  return { end: async () => {} };",
      "};",
      "try {",
      "  const { createDatabaseManager } = await import('./src/core/db/client.ts');",
      "  const logger = { info() {}, error() {}, debug() {} };",
      "  const manager = createDatabaseManager(logger);",
      "  const client = manager.getClient();",
      "  await manager.destroy();",
      "  console.log(JSON.stringify({",
      "    constructorName: client.constructor.name,",
      "    host: capturedConfig.host,",
      "    port: capturedConfig.port,",
      "    database: capturedConfig.database,",
      "    user: capturedConfig.user,",
      "    connectionLimit: capturedConfig.connectionLimit,",
      "  }));",
      "} finally {",
      "  mysqlModule.createPool = originalCreatePool;",
      "}",
    ].join("\n"),
    env,
  );

  assert.equal(result.constructorName, "Kysely");
  assert.equal(result.host, "mysql.test");
  assert.equal(result.port, 3308);
  assert.equal(result.database, "myai_novel_test");
  assert.equal(result.user, "tester");
  assert.equal(result.connectionLimit, 7);
});

test("llm logging hides or shows content based on env switch", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-llm-log-"));

  const runCase = async (enabled: boolean): Promise<string> => {
    const caseDir = path.join(tempDir, enabled ? "enabled" : "disabled");
    const env = createTestEnv(caseDir, {
      LOG_LEVEL: "info",
      LOG_LLM_CONTENT_ENABLED: enabled ? "true" : "false",
    });

    await runInlineModule(
      [
        "import { createLogger, createRunContext } from './src/core/logger/index.ts';",
        "import { MockLlmClient } from './src/core/llm/providers/mock.ts';",
        "const logger = createLogger(createRunContext({ command: 'test.llm.logging' }));",
        "const client = new MockLlmClient(logger);",
        "await client.generate({",
        "  messages: [",
        "    { role: 'system', content: '测试系统' },",
        "    { role: 'user', content: '输出一段测试文本' },",
        "  ],",
        "});",
        "await new Promise((resolve) => setTimeout(resolve, 50));",
        "console.log(JSON.stringify({ ok: true }));",
      ].join("\n"),
      env,
    );

    const files = await fs.readdir(path.join(caseDir, "logs"));
    const logName = files.find((file) => file.startsWith("app-"));

    assert.ok(logName, "expected log file to be created");
    return fs.readFile(path.join(caseDir, "logs", logName), "utf8");
  };

  const enabledLog = await runCase(true);
  const disabledLog = await runCase(false);

  assert.match(enabledLog, /"content":"\[system\] 测试系统\\n\\n\[user\] 输出一段测试文本"/);
  assert.doesNotMatch(disabledLog, /"content":/);
});
