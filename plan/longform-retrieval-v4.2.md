# 长篇小说检索升级计划（v4.2）

> 基于当前仓库代码 review 的增量升级计划。  
> 对应已有计划：`plan/longform-retrieval-v4.md`、`plan/longform-retrieval-v4.1.md`

## 背景

`v4` 解决的是超长篇检索体系最终应该长成什么样。  
`v4.1` 解决的是现有 workflow 里已经确认的稳定性问题和中长篇窗口偏小的问题。

`v4.2` 往前再走一步，聚焦一个更具体的问题：

**在不推翻当前 `plan -> draft -> review -> repair -> approve` 共享上下文模式的前提下，把这套系统提升到更接近“可稳定支撑 1000+ 章小说”的状态。**

这份计划不把“全面重写 retrieval 架构”当作默认路径，而是优先做：

1. 校准当前代码基线。
2. 放大超长篇真正缺的长期记忆能力。
3. 让旧事实、旧事件、旧伏笔更稳定地进入最终 prompt。

---

## 当前代码基线

以下结论以当前仓库代码为准。

### 1. `plan` 不是单次召回，而是两次召回

当前主链路：

1. `cli plan`
2. `PlanChapterWorkflow.run()`
3. 第一次 `retrievePlanContext()`：轻量召回，只为辅助生成或校正 `authorIntent`
4. `buildKeywordExtractionPrompt()`：提取结构化 intent / keywords / mustInclude / mustAvoid
5. 第二次 `retrievePlanContext()`：正式召回，生成会被固化到 `chapter_plans.retrieved_context` 的共享上下文
6. `buildPlanPrompt()`：组装最终规划 prompt

这意味着当前 `plan` 已经具备“先定意图，再做正式召回”的基本正确方向。

### 2. 最终 prompt 吃到的是压缩后的上下文，而不是全量 DB 内容

`buildPromptContextBlocks()` 会把检索结果压成固定区块：

1. `mustFollowFacts`
2. `recentChanges`
3. `coreEntities`
4. `requiredHooks`
5. `forbiddenMoves`
6. `supportingBackground`

`plan` 模式下默认总字符预算为：

- `PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET=4400`

并且 `buildCompactRetrievedContextForPrompt()` 在 `plan` 阶段实际只保留：

1. `mustFollowFacts`
2. `recentChanges`
3. `requiredHooks`
4. `forbiddenMoves`

`supportingBackground` 在 `plan` 模式下不会进入 compact JSON。

### 3. 当前默认窗口更适合中等规模长篇，不是千章级长期记忆

当前默认值：

1. `PLANNING_RETRIEVAL_OUTLINE_LIMIT=3`
2. `PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT=8`
3. `PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT=10`
4. `PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT=6`

这些值对几十章到一两百章规模仍然有现实可用性，但对 1000+ 章会过浅。

### 4. embedding 已接线，但默认仍不是主链能力

当前默认值：

1. `PLANNING_RETRIEVAL_RERANKER=heuristic`
2. `PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=none`

这说明：

1. 启发式 reranker 已经是默认配置。
2. embedding 仍然默认关闭。
3. 默认主链依旧更偏规则召回和 sidecar 事实压缩。

### 5. 当前 embedding 只覆盖实体级摘要，不覆盖章节级长期记忆

当前 embedding 文档覆盖：

1. `character`
2. `faction`
3. `item`
4. `hook`
5. `relation`
6. `world_setting`

它还没有直接覆盖：

1. `retrieval_facts`
2. `story_events`
3. `chapter_segments`
4. 章节级摘要 / arc 级摘要

所以当前 embedding 更像“实体候选增强层”，而不是“章节语义长期记忆层”。

---

## 当前系统对 1000+ 章的真实结论

当前系统：

- **能工作**
- **能生成 1000+ 章**
- **但还不能自信地说，能稳定维护 1000+ 章连续性**

真正的问题不是“完全没有长期记忆”，而是：

1. 长期记忆已写回，但进入 prompt 的槽位太少。
2. 检索仍偏近窗和实体级单位。
3. 旧事件、旧承诺、旧伏笔的长距离承接仍不够稳。
4. 压缩是确定性裁剪，不是面向超长篇的分层记忆装配。

---

## v4.2 目标

`v4.2` 只做四类事情：

1. 让当前 sidecar 记忆更稳定地 surfacing 到 `plan` prompt。
2. 让超长篇场景下的“远距离旧事实 / 旧事件 / 未回收钩子”更容易被保留。
3. 在不破坏现有 `retrieved_context` 兼容性的前提下，补章节级长期记忆入口。
4. 为后续更重的 `v4` 多层检索体系补齐验证基础。

`v4.2` 不做的事情：

1. 不推翻 `RetrievalQueryService` 主链。
2. 不切到纯 embedding 检索。
3. 不要求立即重做所有 schema。
4. 不把 `draft / review / repair / approve` 改成各自独立召回。

---

## 核心问题清单

### 1. 长期记忆不是“没有”，而是“排不进去”

当前 `retrieval_facts`、`story_events`、`recentChanges`、`priorityContext` 都已经存在。

问题在于：

1. top-k 太小。
2. prompt 预算太保守。
3. 长距离旧记忆和近期高频实体竞争时，旧记忆容易被裁掉。

### 2. 当前 sidecar 更像辅助层，还没有成为超长篇主力层

sidecar 已参与：

1. `priorityContext`
2. `riskReminders`
3. `recentChanges`

但它还没有形成一个明确的“超长篇长期记忆优先入口”。

### 3. embedding 只会补实体相关性，不会直接补章节因果链

这会导致：

1. 能更容易找到“这个角色是谁”。
2. 但不够容易找到“这个旧事件为什么现在还重要”。
3. 也不够容易找到“这个伏笔当初埋在哪一章、现在该怎么接”。

### 4. 当前 long-tail 机制有保底，但还不是长期记忆策略

现在已有 long-tail reserve，但它更像兜底而不是主策略。

对 1000+ 章来说，需要的是：

1. 明确保留高风险远程事实。
2. 明确保留未收束旧事件。
3. 明确保留跨 arc 的关键钩子。

### 5. 缺少章节级 / arc 级记忆的稳定接入口

当前系统最自然的下一步不是先重构主链，而是补：

1. chapter-level retrieval memory
2. arc-level summary memory
3. unresolved threads / continuity ledger

---

## 升级原则

1. 先校准基线，再扩窗口，再补章节级记忆，再评估更重升级。
2. 先让“重要旧事实更稳定进入 prompt”，再追求“更聪明的语义检索”。
3. 保持 `chapter_plans.retrieved_context` 兼容。
4. 继续保留规则召回作为稳定基线。
5. embedding 继续做增强层，不替代规则链路。
6. 所有升级都要可观测、可回退、可 benchmark。

---

## 实施优先级

## P0：基线校准与文档对齐

### P0-1 统一超长篇讨论前提

目标：避免继续基于过时计划文档讨论实现。

要求：

1. 以当前代码为准更新文档事实。
2. 明确当前默认值是 `heuristic reranker` 而不是 `none`。
3. 明确 `plan` 是两次召回。
4. 明确 `plan` prompt budget 是 `4400`。

### P0-2 为超长篇能力建立单独评估口径

目标：让“能不能撑 1000+ 章”可以被量化，而不是只靠感觉。

要求：

1. 长距离连续性 benchmark 单独分组。
2. 远程事实 / 旧事件 / 旧钩子命中率单独观察。
3. prompt 被裁剪掉的关键事实可追踪。

---

## P1：最小改动先放大有效记忆窗口

### P1-1 提高 persisted facts / events 选择上限

目标：让远距离连续性信息更容易进入最终上下文。

建议方向：

1. 提高 `PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT`
2. 提高 `PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT`
3. 相应提高 priority / risk surfacing 相关保留数

### P1-2 提高 `plan` prompt context budget

目标：不要让真正重要的旧事实还没进入模型就被预算截掉。

优先调整：

1. `PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET`
2. `mustFollowFacts`
3. `recentChanges`
4. `requiredHooks`

### P1-3 重调 section 预算分配

目标：让 sidecar 长期记忆不要总输给近期实体背景。

要求：

1. `mustFollowFacts` 的预算优先级高于背景类信息。
2. `recentChanges` 中远章节高风险项不能只靠自然排序偶然进入。
3. `requiredHooks` 不能被近期实体噪声挤掉。

### P1-4 强化 long-tail 保留策略

目标：把远距离旧事实保底升级为明确策略。

要求：

1. 高风险事实稳定保留。
2. 未收束旧事件稳定保留。
3. 手工锚点相关的远章节记忆稳定保留。

---

## P2：把 sidecar 从辅助层提升为超长篇主力层

### P2-1 强化 `retrieval_facts` 的连续性角色

目标：让 `retrieval_facts` 不只是“回写日志”，而是超长篇 planning 的高价值记忆单元。

方向：

1. 更稳定区分 blocking / decision / supporting facts
2. 提高高风险事实在 `hardConstraints` 和 `mustFollowFacts` 中的可见性
3. 增强对慢变量规则、关系状态、位置状态、持有状态的持续 surfacing

### P2-2 强化 `story_events` 的未收束影响权重

目标：让“发生过什么”升级为“现在仍受什么影响”。

要求：

1. `unresolved_impact` 在选择和排序中更有存在感。
2. 远章节但仍未收束的事件优先级明显高于普通旧事件。
3. 对钩子、参与方、后果链形成稳定承接。

### P2-3 强化 sidecar observability

目标：能回答“为什么这条旧记忆没进 prompt”。

至少增加：

1. sidecar top-k 截断统计
2. long-tail reserve 命中统计
3. 各 section 裁剪损失统计
4. 远章节事实进入最终 prompt 的比例统计

---

## P3：补章节级长期记忆，但先复用现有资产

### P3-1 优先从已有 `chapter_segments` 和章节摘要中接入

目标：给系统补一层“旧章节发生过什么”的可检索记忆。

原则：

1. 先复用现有 `chapter_segments`
2. 先复用历史章节 summary
3. 先以最小接线路径接入 `plan`

### P3-2 先做规则式或轻量混合式章节记忆接入

目标：避免一上来就把章节级记忆做成全新复杂主链。

方向：

1. 章节级摘要候选选择
2. arc 级摘要候选选择
3. 与 sidecar facts / events 协同装配

### P3-3 补一份 `continuity ledger`

目标：把超长篇最容易漂移的长期约束稳定固化下来。

建议内容：

1. 未回收伏笔
2. 未兑现承诺
3. 关键关系状态
4. 世界规则边界
5. 角色长期目标与当前位置

---

## P4：可选增强，再评估 embedding 向章节记忆扩展

### P4-1 embedding 默认启用的前提评估

目标：确认 embedding 真的能稳定增益超长篇，而不是只是增加复杂度。

要求：

1. 保留 rule-based baseline
2. 先通过 benchmark
3. 先验证实体级增强不会引入明显噪声

### P4-2 逐步扩到 `fact / event / segment` 语义层

目标：让 embedding 不只会找实体，还能找历史因果链。

顺序建议：

1. `story_events`
2. `retrieval_facts`
3. `chapter_segments`

这样做的原因是：

1. event / fact 粒度比整章更稳定。
2. 它们更接近连续性原子单位。
3. 更适合作为超长篇长期检索基础。

---

## 推荐里程碑

### Milestone A：先把“看得见的长期记忆”拉高

包含：

1. 调整 sidecar top-k
2. 调整 `plan` prompt budget
3. 调整 section 配额
4. 补 long-tail 策略观测

完成标准：

1. 远章节高风险事实进入 `plan` prompt 的比例上升。
2. 不明显增加噪声和无关背景。

### Milestone B：让 sidecar 真正承担超长篇主记忆职责

包含：

1. 强化 `retrieval_facts`
2. 强化 `story_events`
3. 提升 unresolved impact 的承接能力
4. 增强 observability

完成标准：

1. 长距离旧事件和旧伏笔更稳定 surfacing。
2. 可以解释为什么某条记忆没进 prompt。

### Milestone C：补章节级和 arc 级记忆入口

包含：

1. 章节摘要接线
2. `chapter_segments` 接线
3. continuity ledger 原型

完成标准：

1. 系统可以更稳定回答“这件事以前在哪发生过”。
2. 不再只依赖最近 8 章摘要承接长距离剧情。

---

## 验收标准

`v4.2` 的成功，不是“把更多东西塞进 prompt”，而是：

1. 超长篇里高风险旧事实更稳定进入最终 prompt。
2. 旧事件的未收束影响更稳定进入最终 prompt。
3. 旧钩子和跨 arc 连续性不再主要靠最近章节窗口碰运气。
4. 对为什么命中 / 为什么被裁掉有更清楚的解释链。
5. 保持现有 workflow 与 `retrieved_context` 兼容，不做大爆炸式重写。

---

## 可能涉及的代码位置

1. `src/domain/workflows/plan-chapter-workflow.ts`
2. `src/domain/planning/retrieval-service.ts`
3. `src/domain/planning/retrieval-context-builder.ts`
4. `src/domain/planning/prompt-context-blocks.ts`
5. `src/domain/planning/retrieval-priorities.ts`
6. `src/domain/planning/recent-changes.ts`
7. `src/domain/planning/retrieval-service-factory.ts`
8. `src/domain/planning/embedding-index.ts`
9. `src/config/env.ts`
10. `docs/retrieval-pipeline-guide.md`
11. `docs/embedding-rerank-architecture.md`

---

## 总结

`v4.1` 之后，系统已经不再是“没有长期记忆”，而是“长期记忆还不够稳地进入超长篇 planning prompt”。

所以 `v4.2` 的重点不是重写，而是：

1. 先把 sidecar 记忆真正用起来。
2. 先把远距离高风险事实稳定保住。
3. 先补章节级记忆入口。
4. 再决定是否进入更重的多层 embedding 检索阶段。

如果 `v4.2` 做得对，那么后续 `v4` 的更大结构升级会变成“锦上添花”；否则，即使继续扩 schema，也只是把更多长期记忆写进库里，却仍然排不进模型真正消费的上下文。
