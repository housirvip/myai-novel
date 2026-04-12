import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCharacterEmbeddingText,
  buildHookEmbeddingText,
  buildWorldSettingEmbeddingText,
} from "../../../src/domain/planning/embedding-text.js";

test("character embedding text keeps identity, motivation and continuity risk readable", () => {
  const text = buildCharacterEmbeddingText({
    id: 1,
    name: "林夜",
    alias: "夜行客",
    summary: "外门新入弟子，真实来历不能暴露。",
    goal: "借黑铁令进入内门视野。",
    background: "早年经历灭门案，对高层天然不信任。",
    personality: "冷静谨慎",
    current_location: "青岳宗外门",
    status: "alive",
    notes: "不能提前暴露真实身份。",
  });

  assert.match(text, /人物：林夜/);
  assert.match(text, /别名：夜行客/);
  assert.match(text, /核心动机：借黑铁令进入内门视野/);
  assert.match(text, /当前状态：状态=alive；地点=青岳宗外门/);
  assert.match(text, /连续性风险：不能提前暴露真实身份/);
});

test("hook embedding text keeps foreshadowing and payoff readable", () => {
  const text = buildHookEmbeddingText({
    id: 3,
    title: "黑铁令旧案",
    description: "一枚令牌牵出旧日禁案。",
    foreshadowing: "多位高层看见令牌后反应异常。",
    expected_payoff: "主角因此被卷入内门调查。",
    status: "active",
    target_chapter_no: 12,
    notes: "过晚推进会削弱前文铺垫。",
  });

  assert.match(text, /钩子：黑铁令旧案/);
  assert.match(text, /铺垫：多位高层看见令牌后反应异常/);
  assert.match(text, /预期兑现：主角因此被卷入内门调查/);
  assert.match(text, /当前推进：状态=active；目标章节=12/);
});

test("world setting embedding text keeps rule summary readable", () => {
  const text = buildWorldSettingEmbeddingText({
    id: 2,
    title: "宗门制度",
    category: "制度",
    content: "外门弟子进入内门区域必须持有登记令牌。",
    notes: "不能无手续越级进入。",
  });

  assert.match(text, /设定：宗门制度/);
  assert.match(text, /类别：制度/);
  assert.match(text, /规则摘要：外门弟子进入内门区域必须持有登记令牌/);
  assert.match(text, /连续性风险：不能无手续越级进入/);
});
