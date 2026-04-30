# 长篇小说检索升级任务拆分（v4.1）

> 对应总计划：`plan/longform-retrieval-v4.1.md`

这份文档聚焦当前实现的稳定性补强，目标是在不推翻现有 workflow 的前提下，先补齐中长篇写作最容易出错的召回与写回链路。

---

## 总体执行原则

1. 先修 bug，再扩容，再增强。
2. 先补写回质量，再提升召回规模。
3. 保持 `retrieved_context` 兼容，不做大爆炸式改造。
4. 每个任务都要可验证、可回退、可观测。

---

## 任务分组总览

1. T0：事件结构兼容修复
2. T1：长期记忆写回补强
3. T2：召回窗口与预算扩容
4. T3：事实源边界修正
5. T4：召回增强与排序优化
6. T5：验证、观测与收尾

---

## T0：事件结构兼容修复

### T0-1 统一 `story_events.participant_entity_refs` 写入结构

**目标**

让新写入的 `story_events` 使用统一、明确、可稳定解析的 participant schema。

**任务**

1. 审查 `approve-chapter-workflow.ts` 当前写入结构。
2. 设计统一 participant schema。
3. 更新 `story_events` 新写入逻辑。
4. 保持和已有 repository / DB 字段兼容。

**涉及位置**

- `src/domain/workflows/approve-chapter-workflow.ts`
- `src/domain/planning/types.ts`
- `src/core/db/repositories/story-event-repository.ts`

**完成标准**

1. 新写入数据结构固定。
2. 后续 retrieval 侧不再依赖模糊解析。

---

### T0-2 给 retrieval 增加 participant 旧数据兼容解析

**目标**

让历史 `story_events` 数据在升级后仍可被正确召回。

**任务**

1. 检查 `parseParticipantEntityRefs()` 当前假设。
2. 同时兼容数组结构和对象分桶结构。
3. 为异常结构增加保护和日志。
4. 验证 `matchesStoryEventRefs()` 命中恢复。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`

**完成标准**

1. 旧数据不需要立刻迁移也能工作。
2. 手工实体锚点能重新命中相关旧事件。

---

### T0-3 为 participant 匹配增加测试

**目标**

把这类结构 bug 固化成自动测试，避免回归。

**任务**

1. 为数组格式写测试。
2. 为对象分桶格式写测试。
3. 为异常空值 / 非法值写测试。
4. 覆盖人物、势力、物品、钩子等匹配路径。

**涉及位置**

- `test/` 下 retrieval 相关测试

**完成标准**

1. 两种历史格式都能通过测试。
2. 后续重构时不会悄悄退化。

---

## T1：长期记忆写回补强

### T1-1 在 approve diff 中引入 `unresolved_impact`

**目标**

让 `story_events` 能表达“还未解决、将持续影响后文”的内容。

**任务**

1. 扩展 approve diff prompt 的输出要求。
2. 在 diff schema 中增加 `unresolvedImpact` 字段。
3. 在 approve 流程中解析并落库。
4. 定义缺失时的安全 fallback。

**涉及位置**

- `src/domain/planning/prompts.ts`
- `src/domain/workflows/approve-chapter-workflow.ts`
- 相关 diff schema / parser 文件

**完成标准**

1. 新生成的 `story_events.unresolved_impact` 不再长期为空。
2. 旧事件后果可以参与后续召回评分。

---

### T1-2 扩展 `retrieval_facts` 的结构变化覆盖面

**目标**

让结构化状态变化也能变成可召回的 sidecar fact。

**任务**

1. 审查 `buildUpdateFactText()` 当前覆盖字段。
2. 为人物位置、目标、阵营、物品归属、关系强度、世界规则边界等字段生成文本事实。
3. 对无文本字段设计稳定模板。
4. 增加去重和空文本保护。

**涉及位置**

- `src/domain/workflows/approve-chapter-workflow.ts`
- `src/domain/planning/retrieval-facts.ts`

**完成标准**

1. 关键结构更新都能生成至少一条可检索 fact。
2. “表里有更新、侧车没事实”的情况明显减少。

---

### T1-3 给 approve 回写失败增加 observability

**目标**

避免 update 被跳过但没有人发现。

**任务**

1. 为 skipped update 记录数量。
2. 为 skipped update 记录原因。
3. 为脏引用、找不到实体、非法 payload 增加日志。
4. 如合适，回传到 CLI 输出摘要。

**涉及位置**

- `src/domain/workflows/approve-chapter-workflow.ts`
- `src/domain/planning/retrieval-observability.ts`
- `src/cli/commands/approve.ts` 或相关输出位置

**完成标准**

1. 可以回答“哪些 update 没写进去”。
2. 数据质量问题不再静默累积。

---

## T2：召回窗口与预算扩容

### T2-1 提高 persisted facts / events 的召回上限

**目标**

扩大中长篇场景的长期记忆窗口。

**任务**

1. 审查 retrieval facts 当前筛选上限。
2. 审查 story events 当前筛选上限。
3. 调整 top-k 及 priorityContext 的保留数。
4. 为 short-form / long-form 预留不同配置值。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/config/env.ts`

**完成标准**

1. 50+ 章项目的长期事实保留能力增强。
2. 不会明显挤爆 prompt 或拖慢响应。

---

### T2-2 提高 prompt context budgets

**目标**

让已召回的关键事实真正有机会进入 prompt。

**任务**

1. 评估 `plan / draft / review / repair / approve` 当前预算。
2. 拉高 `plan / draft / repair / approve` 预算上限。
3. 审查 section 裁剪顺序是否仍合理。
4. 记录 budget 扩大后的命中收益。

**涉及位置**

- `src/config/env.ts`
- `src/domain/planning/prompt-context-blocks.ts`
- `src/domain/planning/prompts.ts`

**完成标准**

1. 连续性关键事实在中长篇下不再被过早裁掉。
2. prompt 变长后仍可控。

---

### T2-3 增加长篇 preset

**目标**

让中长篇场景可以通过配置一键切换更大的预算和窗口。

**任务**

1. 新增长篇 preset 或分组配置。
2. 文档化长篇参数建议值。
3. 保持默认短中篇配置兼容。
4. 如需要，通过 feature flag 控制。

**涉及位置**

- `src/config/env.ts`
- `.env.example`
- `docs/env-config-guide.md`

**完成标准**

1. 不改代码即可切到更适合长篇的参数。
2. 默认模式不被破坏。

---

## T3：事实源边界修正

### T3-1 禁止将 `author_intent` 直接混作 recent chapter fact

**目标**

确保“前情摘要”只表示已发生事实。

**任务**

1. 审查 recent chapter summary 的回退逻辑。
2. 去掉或隔离 `chapter_plan.author_intent` 回退。
3. 如果保留 plan 信息，显式标记为 planning-only source。
4. 为事实视图与计划视图建立边界。

**涉及位置**

- `src/domain/planning/retrieval-candidate-provider-rule.ts`
- `src/domain/planning/context-views.ts`
- `src/domain/planning/types.ts`

**完成标准**

1. recent chapter 事实层不再混入 author intent。
2. 回顾前文时不会把“打算发生”误认成“已经发生”。

---

### T3-2 为事实来源增加可观测标签

**目标**

让上下文中的事实来源可以被区分和调试。

**任务**

1. 为 recent chapters 增加 source kind。
2. 为 facts / events / chapter summary 增加 provenance 标签。
3. 在 observability 中展示各来源占比。

**涉及位置**

- `src/domain/planning/types.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-observability.ts`

**完成标准**

1. 可以快速判断 prompt 中哪些内容来自摘要、哪些来自 sidecar、哪些来自计划。

---

## T4：召回增强与排序优化

### T4-1 默认启用 heuristic reranker

**目标**

用最低风险的方式先提升当前排序质量。

**任务**

1. 评估 `heuristic` 与 `none` 的差异。
2. 调整默认配置。
3. 验证是否影响现有 benchmark。
4. 文档化切换方法。

**涉及位置**

- `src/config/env.ts`
- retrieval service / reranker 相关模块

**完成标准**

1. 默认排序更贴近连续性风险。
2. 不需要引入额外基础设施。

---

### T4-2 评估 hybrid embedding 增强路径

**目标**

提升抽象意图与长距离语义关联的召回能力。

**任务**

1. 梳理当前 embedding path 是否可直接启用。
2. 增加 long-form benchmark 对比：rule-only vs hybrid。
3. 确认 latency、成本和命中收益。
4. 设计渐进启用策略。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/embedding-*`
- benchmark 与 env 配置

**完成标准**

1. 能量化 hybrid 对长篇场景的收益。
2. 是否默认启用有明确结论。

---

### T4-3 优化同名实体复用策略

**目标**

降低 approve 阶段实体误合并导致的长期污染。

**任务**

1. 审查角色、势力、物品、设定的同名复用逻辑。
2. 增加二次校验条件。
3. 不满足条件时允许新建。
4. 为高风险复用增加日志。

**涉及位置**

- `src/domain/workflows/approve-chapter-workflow.ts`

**完成标准**

1. 长篇里同名误合并显著减少。

---

## T5：验证、观测与收尾

### T5-1 补回归测试和 benchmark

**目标**

用自动化验证锁住 `v4.1` 的收益。

**任务**

1. 为 participant refs 兼容补测试。
2. 为 unresolved impact 写回补测试。
3. 为 retrieval facts 扩展写回补测试。
4. 为 recent chapter source boundary 补测试。
5. 为 long-form budget / top-k 变化补 benchmark。

**涉及位置**

- `test/` 目录下相关测试

**完成标准**

1. `v4.1` 的关键修复均有测试覆盖。
2. 后续进入 `v4` 结构升级时可以检测回归。

---

### T5-2 真实书籍抽样验证

**目标**

确认改动不只是测试通过，而是真的改善中长篇生成稳定性。

**任务**

1. 选 1 本 30-50 章书做验证。
2. 选 1 本 80-150 章书做验证。
3. 检查回收旧承诺、角色状态延续、世界规则再浮现。
4. 记录失败样本并回灌 benchmark。

**完成标准**

1. 实际书籍中的连续性错误率下降。
2. benchmark 与真实观察基本一致。

---

## 推荐执行顺序

建议按下面顺序推进：

1. T0-1
2. T0-2
3. T0-3
4. T1-1
5. T1-2
6. T1-3
7. T2-1
8. T2-2
9. T2-3
10. T3-1
11. T3-2
12. T4-1
13. T4-2
14. T4-3
15. T5-1
16. T5-2

---

## 建议第一批落地任务

如果现在就要开工，我建议先只做下面 6 项：

1. T0-1：统一 `participant_entity_refs` 写入结构
2. T0-2：兼容旧 participant 格式读取
3. T1-1：补 `unresolved_impact`
4. T1-2：扩展 `retrieval_facts` 结构更新写回
5. T1-3：补 approve skip observability
6. T2-1：提高 persisted facts / events 召回上限

原因：

1. 这 6 项都直接改善当前生成准确性。
2. 改动收益明确，不依赖更大架构改造。
3. 做完后再放大 budget 和启用增强检索，风险更低。

---

## Definition of Done

这份任务拆分完成，不代表项目完成。`v4.1` 真正完成的标准是：

1. `story_events` 的实体关联召回稳定可用。
2. `story_events.unresolved_impact` 能稳定参与后续召回。
3. 关键结构变化能被写成可检索 fact。
4. `author_intent` 不再污染事实层。
5. 长期 facts / events / prompt budget 对中长篇明显更友好。
6. approve 写回失败、脏引用和裁剪损失都可观测。
7. 自动化测试和真实样本都验证改进有效。
