# 长篇小说检索升级计划（v4.1）

> 基于当前仓库代码 review 的增量升级计划。
> 对应已有总计划：`plan/longform-retrieval-v4.md`

## 背景

`v4` 解决的是“长篇检索最终应该长成什么样”。

`v4.1` 解决的是另一个更现实的问题：

在进入更重的结构升级前，先把当前 `plan -> draft -> review -> repair -> approve` 链路补到足够稳定，避免中长篇写作过程中因为召回、写回和 prompt 压缩问题导致事实漂移、连续性丢失和生成不准确。

这份计划的目标不是推翻 `v4`，而是作为 `v4` 之前的稳定性增强层。

---

## 当前系统的结论

当前实现已经具备这些正确方向：

1. `plan` 是统一检索入口。
2. `retrieved_context` 会被持久化。
3. `draft / review / repair / approve` 复用同一份共享上下文。
4. 规则召回仍然是稳定基线。
5. 已经引入了 `retrieval_facts`、`story_events`、`chapter_segments`、`retrieval_documents` 等长期记忆侧车。

但对中长篇来说，当前主要问题不是“有没有结构”，而是：

1. 长期记忆写回还不够强。
2. 结构化事件召回存在明确 bug。
3. prompt 最终吃到的有效事实偏少。
4. 默认规则召回仍偏关键词驱动，语义相关召回偏弱。
5. 某些回退路径会把“作者意图”误当成“既成事实”。

---

## v4.1 目标

`v4.1` 只做三类事情：

1. 修正当前链路中已经确定的召回 / 写回漏洞。
2. 扩大中长篇场景下的有效上下文窗口。
3. 为后续 `v4` 的长篇架构升级补观测、兼容和任务切片。

不在 `v4.1` 中完成的事情：

1. 不重写整条 retrieval pipeline。
2. 不在这一版强行切到纯 embedding 检索。
3. 不做大规模 schema 改造之外的新范式切换。

---

## 核心问题清单

### 1. `story_events.participant_entity_refs` 读写格式不一致

当前 `approve` 写入的是按实体组分桶的对象；而 retrieval 侧读取时按数组结构解析。

这会导致：

1. `story_events` 与手工实体锚点的结构化匹配失效。
2. 历史事件对当前章节的承接能力被削弱。
3. 中长篇里“某角色与某旧事件强相关”的召回不稳定。

### 2. `story_events.unresolved_impact` 没被稳定写入

事件表已经有“未收束影响”字段，但当前 `approve` 落库时基本没有真正填充。

这会导致：

1. 系统能记住“发生过什么”，但记不住“还欠着什么”。
2. 伏笔、旧承诺、后遗症、未解决冲突很难在后续章节被强召回。

### 3. `retrieval_facts` 对结构更新覆盖不足

当前 `persistApproveRetrievalFacts()` 主要为 `summary` 和少数文本型 update 生成事实。

这会导致：

1. DB 表里的结构更新成功了。
2. 但 sidecar fact 没有对应文本事实。
3. 后续 planning 更难把关键变化再次抬进 prompt。

### 4. `recentChapters` 存在把 `author_intent` 当摘要的回退路径

当前近期章节摘要在缺少章节 summary 时，可能回退到 `chapter_plan.author_intent`。

这会导致：

1. 系统把“计划写什么”误当成“已经发生什么”。
2. 对连续性尤其危险。

### 5. prompt 预算和 sidecar 召回窗口对中长篇偏小

当前 facts / events 的入选上限、priorityContext 的保留数、prompt char budget 都偏保守。

这会导致：

1. 检索结果在 DB 里存在。
2. 但最后进 prompt 的连续性关键单元太少。
3. 中长篇里容易丢配角状态、远期钩子和慢变量规则。

### 6. 默认召回仍偏关键词驱动

默认配置下：

1. `PLANNING_RETRIEVAL_RERANKER=none`
2. `PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=none`

这意味着当前主链路更偏规则匹配和关键词触发。

对中长篇里更抽象的意图信号，例如：

1. 长距离回收
2. 关系微变化
3. 规则再浮现
4. 旧事件后果延续

召回能力仍然不够稳。

---

## 升级原则

1. 先修确定 bug，再扩容，再增强。
2. 先保证写回质量，再谈更强召回。
3. 尽量保持现有 `retrieved_context` 兼容。
4. 不破坏现有 CLI workflow。
5. 能通过 feature flag 或配置渐进启用的，不做硬切换。

---

## 实施优先级

## P0：立即修复

### P0-1 修复 `story_events.participant_entity_refs` 兼容层

目标：恢复事件与实体锚点的结构化匹配能力。

要求：

1. 新写入结构统一。
2. 旧数据读取兼容。
3. `matchesStoryEventRefs()` 能正确识别人物、势力、物品、钩子等关联。

### P0-2 给 `story_events` 补 `unresolved_impact`

目标：让历史事件能表达“仍在影响现在”的连续性。

要求：

1. 在 approve diff 中加入未收束影响提取。
2. 落库到 `story_events.unresolved_impact`。
3. 让 retrieval scoring 真正受益。

### P0-3 扩充 `retrieval_facts` 的事实生成

目标：让结构变化能转成可召回的文本事实。

优先覆盖字段：

1. `current_location`
2. `goal`
3. `owner_type` / `owner_id`
4. `status`
5. `relation intensity`
6. `world rule related fields`

### P0-4 增加 approve 回写异常观测

目标：避免“静默跳过 update”长期污染数据质量。

要求：

1. 记录 skipped updates。
2. 输出 skip reason。
3. 支持 CLI 或日志侧观察。

---

## P1：中长篇稳定性增强

### P1-1 调大 persisted facts / events 召回和保留窗口

目标：扩大长期连续性窗口。

建议方向：

1. `retrieval_facts` 选中上限提高。
2. `story_events` 选中上限提高。
3. `priorityContext` 中 persisted packet 的保留数量提高。

### P1-2 提高 prompt context budget

目标：让真正重要的连续性事实有机会进入 prompt。

优先调整：

1. `PLAN`
2. `DRAFT`
3. `REPAIR`
4. `APPROVE`

### P1-3 去掉 `recentChapters <- author_intent` 的事实混用

目标：让“前情摘要”只表示已发生事实。

要求：

1. `author_intent` 不再直接作为 recent chapter summary 的最终回退。
2. 如果必须保留，需显式标注为 plan-only source，不能混入事实层。

### P1-4 强化 retrieval observability

目标：让失败模式可解释。

至少增加：

1. sidecar facts / events 被 top-k 截掉的统计
2. manual refs 未命中的统计
3. prompt section 预算裁剪后的损失统计

---

## P2：召回增强

### P2-1 默认启用 heuristic reranker

目标：在不改架构的前提下提升排序质量。

### P2-2 评估并逐步启用 hybrid embedding

目标：提升对语义相关但关键词不明显的场景的召回能力。

要求：

1. 保留 rule-based baseline。
2. embedding 作为增强层。
3. 先通过 benchmark，再扩大默认使用范围。

### P2-3 优化同名实体复用策略

目标：降低误合并风险。

方向：

1. 同名 + 相似摘要校验
2. 同名 + 关键词校验
3. 不满足条件时允许新建而不是硬复用

---

## 推荐里程碑

### Milestone A：修复当前明显漏洞

包含：

1. `participant_entity_refs` 兼容修复
2. `unresolved_impact` 写回
3. `retrieval_facts` 扩展写回
4. approve skip observability

完成后预期收益：

1. 当前系统召回准确率立即提升。
2. 中篇和中长篇连续性问题明显减少。

### Milestone B：拉高中长篇可用上限

包含：

1. 扩大 facts / events 召回窗口
2. 提高 prompt budget
3. 去掉 `author_intent` 与事实摘要混用
4. 增强 observability

完成后预期收益：

1. 50-150 章级别项目更稳。
2. 多线并行时不容易早丢上下文。

### Milestone C：为 v4 结构升级做准备

包含：

1. 启用 heuristic reranker
2. 评估 hybrid embedding
3. 补 benchmark 和真实书样本对比
4. 明确是否进入 `v4` 的更重结构升级

---

## 与 v4 的关系

`v4.1` 不是 `v4` 的替代，而是前置稳定化阶段。

建议执行顺序：

1. 先完成 `v4.1 P0`
2. 再完成 `v4.1 P1`
3. 之后再决定是否进入 `v4` 的 Phase 2+ 结构升级

换句话说：

- `v4` 解决的是“最终长篇检索架构”
- `v4.1` 解决的是“当前系统先别把中长篇写坏”

---

## 验收标准

只有当下面条件基本成立，才算 `v4.1` 完成：

1. `story_events` 的实体关联可被稳定命中。
2. `story_events` 能表达未收束影响并参与召回。
3. 关键结构更新能稳定写入 `retrieval_facts`。
4. `recentChapters` 不再把作者意图混成既成事实。
5. facts / events / prompt context 对中长篇的保留能力明显提升。
6. 当 approve diff 发生跳过或脏引用时，系统可观测。
7. benchmark 或真实样本验证显示连续性错误率下降。
