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
  });

  const result = await runInlineModule<{
    logDir: string;
    sqlitePath: string;
    provider: string;
  }>(
    [
      "import { env } from './src/config/env.ts';",
      "console.log(JSON.stringify({",
      "  logDir: env.LOG_DIR,",
      "  sqlitePath: env.DB_SQLITE_PATH,",
      "  provider: env.LLM_PROVIDER,",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.provider, "mock");
  assert.match(result.logDir, /tmp-logs$/);
  assert.match(result.sqlitePath, /tmp-db\/novel\.sqlite$/);
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
