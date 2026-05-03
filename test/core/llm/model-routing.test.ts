import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTestEnv, runInlineModule } from "../../helpers/cli.js";

test("resolveLlmModel prefers explicit model over tier defaults", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-routing-explicit-"));
  const env = createTestEnv(tempDir, {
    LLM_LOW_MODEL: "low-tier",
    LLM_MID_MODEL: "mid-tier",
    LLM_HIGH_MODEL: "high-tier",
  });

  const result = await runInlineModule<{
    low: string | undefined;
    mid: string | undefined;
    high: string | undefined;
  }>(
    [
      "import { resolveLlmModel } from './src/core/llm/model-routing.ts';",
      "console.log(JSON.stringify({",
      "  low: resolveLlmModel({ explicitModel: 'manual-low', tier: 'low' }),",
      "  mid: resolveLlmModel({ explicitModel: 'manual-mid', tier: 'mid' }),",
      "  high: resolveLlmModel({ explicitModel: 'manual-high', tier: 'high' }),",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.low, "manual-low");
  assert.equal(result.mid, "manual-mid");
  assert.equal(result.high, "manual-high");
});

test("resolveLlmModel returns configured tier models", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-routing-tier-"));
  const env = createTestEnv(tempDir, {
    LLM_LOW_MODEL: "low-tier",
    LLM_MID_MODEL: "mid-tier",
    LLM_HIGH_MODEL: "high-tier",
  });

  const result = await runInlineModule<{
    low: string | undefined;
    mid: string | undefined;
    high: string | undefined;
  }>(
    [
      "import { resolveLlmModel } from './src/core/llm/model-routing.ts';",
      "console.log(JSON.stringify({",
      "  low: resolveLlmModel({ tier: 'low' }),",
      "  mid: resolveLlmModel({ tier: 'mid' }),",
      "  high: resolveLlmModel({ tier: 'high' }),",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.low, "low-tier");
  assert.equal(result.mid, "mid-tier");
  assert.equal(result.high, "high-tier");
});

test("resolveLlmModel falls back to legacy light and medium aliases", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "myai-novel-routing-legacy-"));
  const env = createTestEnv(tempDir, {
    LLM_LIGHT_MODEL: "legacy-light-tier",
    LLM_MEDIUM_MODEL: "legacy-medium-tier",
  });

  const result = await runInlineModule<{
    low: string | undefined;
    mid: string | undefined;
    high: string | undefined;
  }>(
    [
      "import { resolveLlmModel } from './src/core/llm/model-routing.ts';",
      "console.log(JSON.stringify({",
      "  low: resolveLlmModel({ tier: 'low' }),",
      "  mid: resolveLlmModel({ tier: 'mid' }),",
      "  high: resolveLlmModel({ tier: 'high' }),",
      "}));",
    ].join("\n"),
    env,
  );

  assert.equal(result.low, "legacy-light-tier");
  assert.equal(result.mid, "legacy-medium-tier");
  assert.equal(result.high, undefined);
});
