import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAuthorityReactionQueryCue,
  hasInstitutionalQueryCue,
  hasItemContinuityQueryCue,
  hasLocationContinuityQueryCue,
  hasMembershipQueryCue,
  hasRuleQueryCue,
  hasSourceImmutabilityQueryCue,
  hasSourceObservationQueryCue,
} from "../../../src/domain/planning/retrieval-features.js";

test("retrieval feature helpers detect narrow query intents", () => {
  assert.equal(hasInstitutionalQueryCue(["宗门", "成员"]), true);
  assert.equal(hasRuleQueryCue(["制度", "登记"]), true);
  assert.equal(hasAuthorityReactionQueryCue(["身份", "异常", "反应"]), true);
  assert.equal(hasMembershipQueryCue(["入宗", "关系"]), true);
  assert.equal(hasLocationContinuityQueryCue(["场景", "承接", "位置"]), true);
  assert.equal(hasItemContinuityQueryCue(["易主", "失踪"]), true);
  assert.equal(hasSourceObservationQueryCue(["来源", "观察", "宗门"]), true);
  assert.equal(hasSourceImmutabilityQueryCue(["禁止", "改写", "来源"]), true);
});

test("retrieval feature helpers keep mixed intents narrow", () => {
  assert.equal(hasSourceObservationQueryCue(["来源", "宗门"]), false);
  assert.equal(hasSourceImmutabilityQueryCue(["改写", "宗门"]), false);
  assert.equal(hasLocationContinuityQueryCue(["来源", "观察"]), false);
});
