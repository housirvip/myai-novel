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
  });

  const result = await runInlineModule<{
    logDir: string;
    sqlitePath: string;
    provider: string;
    planningCharacterLimit: number;
    llmDefaultMaxTokens: number;
  }>(
    [
      "import { env } from './src/config/env.ts';",
      "console.log(JSON.stringify({",
      "  logDir: env.LOG_DIR,",
      "  sqlitePath: env.DB_SQLITE_PATH,",
      "  provider: env.LLM_PROVIDER,",
      "  planningCharacterLimit: env.PLANNING_RETRIEVAL_CHARACTER_LIMIT,",
      "  llmDefaultMaxTokens: env.LLM_DEFAULT_MAX_TOKENS,",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.provider, "mock");
  assert.equal(result.planningCharacterLimit, 9);
  assert.equal(result.llmDefaultMaxTokens, 2048);
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
    DB_POOL_MIN: "1",
    DB_POOL_MAX: "12",
  });

  const result = await runInlineModule<{
    client: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolMin: number;
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
      "  poolMin: env.DB_POOL_MIN,",
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
  assert.equal(result.poolMin, 1);
  assert.equal(result.poolMax, 12);
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
