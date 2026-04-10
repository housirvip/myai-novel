import assert from "node:assert/strict";
import test from "node:test";

import { DefaultLlmFactory } from "../../../src/core/llm/factory.js";

const logger = {} as never;

test("llm factory creates expected providers", () => {
  const factory = new DefaultLlmFactory(logger);

  assert.equal(factory.create("mock").constructor.name, "MockLlmClient");
  assert.equal(factory.create("openai").constructor.name, "OpenAiLlmClient");
  assert.equal(factory.create("anthropic").constructor.name, "AnthropicLlmClient");
  assert.equal(factory.create("custom").constructor.name, "CustomLlmClient");
});

test("llm factory rejects unsupported providers", () => {
  const factory = new DefaultLlmFactory(logger);

  assert.throws(
    () => factory.create("unknown" as never),
    /Unsupported LLM provider/,
  );
});
