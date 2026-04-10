import assert from "node:assert/strict";
import test from "node:test";

import { parseLooseJson } from "../../src/shared/utils/json.js";

test("parseLooseJson accepts fenced json content", () => {
  assert.deepEqual(
    parseLooseJson('```json\n{"summary":"ok","issues":[]}\n```'),
    {
      summary: "ok",
      issues: [],
    },
  );
});
