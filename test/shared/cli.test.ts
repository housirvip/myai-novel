import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOptionalKeywordsText,
  parseOptionalNumberArrayText,
  parseOptionalStructuredText,
} from "../../src/shared/utils/cli.js";

test("parseOptionalKeywordsText accepts comma separated values", () => {
  assert.equal(parseOptionalKeywordsText("主线,冲突,线索"), "[\"主线\",\"冲突\",\"线索\"]");
});

test("parseOptionalKeywordsText rejects keywords longer than eight characters", () => {
  assert.throws(() => parseOptionalKeywordsText("这是一个超过八个字的关键词"), /exceeds 8 characters/);
});

test("parseOptionalStructuredText normalizes JSON objects", () => {
  assert.equal(
    parseOptionalStructuredText("{\"realm\":\"炼气\",\"level\":3}", "levels"),
    "{\"realm\":\"炼气\",\"level\":3}",
  );
});

test("parseOptionalNumberArrayText normalizes comma separated numbers", () => {
  assert.equal(parseOptionalNumberArrayText("1,2,3", "ids"), "[1,2,3]");
});
