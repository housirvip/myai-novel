# 长篇小说检索升级任务拆分（v4.2）

> 对应总计划：`plan/longform-retrieval-v4.2.md`

这份文档聚焦 `v4.2` 的落地执行，不讨论大重构路线，优先把当前 sidecar 记忆、长距离旧事实、旧事件、旧钩子，更稳定地送进超长篇 `plan` prompt。

---

## 总体执行原则

1. 先校准基线，再放大窗口，再补章节级记忆，再评估可选增强。
2. 先做最小改动高收益项，不默认进入 schema 重做或主链重写。
3. 保持 `chapter_plans.retrieved_context` 兼容，不破坏现有 workflow。
4. 保留规则召回作为稳定基线，embedding 只做增强层。
5. 每个任务都要求：
   - 可验证
   - 可回退
   - 可观测
   - 有明确完成标准

---

## 任务分组总览

1. T0：基线校准与超长篇评估口径
2. T1：最小改动放大有效记忆窗口
3. T2：sidecar surfacing 强化
4. T3：章节级 / arc 级长期记忆入口
5. T4：可选 embedding 扩展评估
6. T5：验证、抽样与收尾

---

## T0：基线校准与超长篇评估口径

### T0-1 同步 v4.2 文档事实基线

**目标**

让后续超长篇讨论以当前代码事实为准，不再混用过时假设。

**任务**

1. 对齐 `v4.2` 文档与当前代码事实。
2. 明确 `plan` 是两次召回。
3. 明确默认 reranker 是 `heuristic`。
4. 明确 `PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET=4400`。
5. 明确当前 embedding 默认关闭。

**涉及位置**

- `plan/longform-retrieval-v4.2.md`
- `docs/retrieval-pipeline-guide.md`
- `docs/embedding-rerank-architecture.md`

**完成标准**

1. 不再出现与当前代码冲突的默认值描述。
2. 团队讨论超长篇能力时，默认前提和实现一致。

---

### T0-2 建立超长篇 benchmark 分组

**目标**

把“能不能稳定支撑 1000+ 章”变成可量化问题，而不是主观判断。

**任务**

1. 增加独立的 long-form benchmark fixture。
2. 单独统计远距离旧事实、旧事件、旧钩子命中情况。
3. 区分近窗命中和长距离连续性命中。
4. 为后续 rule baseline / 增强方案留对比口径。

**涉及位置**

- `test/helpers/retrieval-benchmark.ts`
- `test/integration/retrieval-benchmark.test.ts`

**完成标准**

1. benchmark 能单独反映长距离连续性表现。
2. 调参或增强时可以直接对比收益，而不是靠感觉。

---

### T0-3 增加 prompt 裁剪与记忆丢失观测

**目标**

能回答“为什么这条旧记忆没进 prompt”。

**任务**

1. 增加 sidecar top-k 截断统计。
2. 增加 long-tail reserve 命中统计。
3. 增加各 section 裁剪损失统计。
4. 增加远章节事实进入最终 prompt 的比例统计。

**涉及位置**

- `src/domain/planning/retrieval-observability.ts`
- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/prompt-context-blocks.ts`

**完成标准**

1. 可以区分记忆是在召回阶段丢失，还是在 prompt 裁剪阶段丢失。
2. 长距离连续性问题不再只能靠人工猜测。

---

## T1：最小改动放大有效记忆窗口

### T1-1 提高 persisted facts / events 选择上限

**目标**

先在不改主链结构的前提下，扩大长期记忆候选池。

**任务**

1. 调整 `PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT`。
2. 调整 `PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT`。
3. 相应校准 priority / risk surfacing 的保留数。
4. 给默认值和长篇建议值留出清晰边界。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/config/env.ts`

**完成标准**

1. 远章节旧事实、旧事件更容易进入正式上下文。
2. 默认行为仍保持可控，不明显拖慢主链。

---

### T1-2 提高 `plan` prompt context budget

**目标**

避免重要旧记忆在进入模型前被预算过早截掉。

**任务**

1. 调整 `PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET`。
2. 重新校准 `plan` 阶段 compact context 的预算分配。
3. 记录预算拉高后的命中收益与裁剪变化。

**涉及位置**

- `src/config/env.ts`
- `src/domain/planning/prompt-context-blocks.ts`
- `src/domain/planning/prompts.ts`

**完成标准**

1. 高风险旧事实进入 `plan` prompt 的比例上升。
2. prompt 变长后，噪声没有明显失控。

---

### T1-3 重调 section 预算优先级

**目标**

让长期记忆 section 不再稳定输给近期背景信息。

**任务**

1. 上调 `mustFollowFacts` 的预算优先级。
2. 为 `recentChanges` 中远章节高风险项保留稳定槽位。
3. 保证 `requiredHooks` 不再容易被近期实体背景挤掉。
4. 明确 section 间裁剪顺序。

**涉及位置**

- `src/domain/planning/prompt-context-blocks.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-priorities.ts`

**完成标准**

1. `mustFollowFacts`、`recentChanges`、`requiredHooks` 的关键内容保留率提升。
2. 背景类信息不再默认挤占长期连续性槽位。

---

### T1-4 强化 long-tail 保留策略

**目标**

把现有 long-tail reserve 从兜底机制提升为明确策略。

**任务**

1. 定义高风险远程事实保留规则。
2. 定义未收束旧事件保留规则。
3. 定义手工锚点相关远章节记忆保留规则。
4. 让保底策略和现有排序、section 裁剪兼容。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-priorities.ts`
- `src/domain/planning/recent-changes.ts`

**完成标准**

1. 长距离关键记忆不再只靠自然排序偶然进入。
2. long-tail 保留结果可观测、可解释。

---

## T2：sidecar surfacing 强化

### T2-1 强化 `retrieval_facts` 的连续性分层

**目标**

让 `retrieval_facts` 从“回写日志”升级为稳定的超长篇记忆单元。

**任务**

1. 更稳定区分 blocking / decision / supporting facts。
2. 让高风险事实更容易进入 `hardConstraints` 和 `mustFollowFacts`。
3. 增强慢变量规则、关系状态、位置状态、持有状态的 surfacing。

**涉及位置**

- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-priorities.ts`
- `src/domain/planning/types.ts`

**完成标准**

1. 关键 sidecar fact 在最终上下文中的可见性提升。
2. “写回了但很少被用到”的情况明显减少。

---

### T2-2 强化 `story_events.unresolved_impact` 的选择权重

**目标**

让“发生过什么”更稳定转化成“现在仍受什么影响”。

**任务**

1. 让 `unresolved_impact` 进入选择和排序规则。
2. 提高远章节但未收束事件的优先级。
3. 强化对钩子、参与方、后果链的承接。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-priorities.ts`

**完成标准**

1. 未收束旧事件比普通旧事件更容易 surfacing。
2. 旧承诺、旧伏笔、旧后果链的承接更稳定。

---

### T2-3 强化 sidecar 来源观测与解释链

**目标**

区分“有 sidecar 记忆”与“sidecar 记忆真的进了 prompt”。

**任务**

1. 增加 sidecar 候选数、入选数、最终入 prompt 数的分层统计。
2. 增加 facts / events / recentChanges / riskReminders 的来源占比。
3. 增加为什么被截掉、被谁挤掉的解释字段。

**涉及位置**

- `src/domain/planning/retrieval-observability.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/types.ts`

**完成标准**

1. 可以快速判断 sidecar 信号卡在哪一层。
2. 能支持后续 benchmark 解释，而不是只给命中结果。

---

## T3：章节级 / arc 级长期记忆入口

### T3-1 从已有章节摘要接入 chapter-level memory

**目标**

先复用已有资产，补一层“旧章节发生过什么”的稳定入口。

**任务**

1. 设计历史章节 summary 的候选接入方案。
2. 设计与当前 `plan` 主链兼容的最小接线路径。
3. 保持 `retrieved_context` 结构兼容。

**涉及位置**

- `src/domain/workflows/plan-chapter-workflow.ts`
- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`

**完成标准**

1. 系统不再只依赖最近章节窗口承接旧剧情。
2. 章节摘要可以作为补充长期记忆来源进入 `plan`。

---

### T3-2 从已有 `chapter_segments` 接入章节片段记忆

**目标**

让“以前在哪一章发生过”有更细粒度的召回入口。

**任务**

1. 设计 `chapter_segments` 的候选选择与接线方案。
2. 设计与 facts / events 协同装配的规则。
3. 设计最小可用的 prompt surfacing 方式。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/types.ts`

**完成标准**

1. 旧章节内容能通过章节片段稳定补充进 planning 上下文。
2. 不需要先重构整个 retrieval 主链。

---

### T3-3 增加 arc-level summary memory

**目标**

为跨 arc 连续性补一层比章节更高的长期记忆视图。

**任务**

1. 设计 arc 级摘要候选模型或装配规则。
2. 设计与章节摘要、facts、events 的协同优先级。
3. 为跨 arc 钩子和长期目标增加 surfacing 入口。

**涉及位置**

- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-priorities.ts`

**完成标准**

1. 跨 arc 关键线索不再只靠单章 summary 碰运气。
2. arc 级记忆能在不爆 prompt 的前提下提供补强。

---

### T3-4 补 continuity ledger 原型

**目标**

把最容易漂移的长期约束单独固化成可持续 surfacing 的记忆层。

**任务**

1. 设计最小 continuity ledger 结构。
2. 至少覆盖：
   - 未回收伏笔
   - 未兑现承诺
   - 关键关系状态
   - 世界规则边界
   - 角色长期目标与当前位置
3. 设计与现有 sidecar / chapter memory 的协同装配规则。

**涉及位置**

- `src/domain/planning/types.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/recent-changes.ts`

**完成标准**

1. 超长篇最容易漂移的长期约束有单独入口。
2. continuity ledger 可以作为后续更重升级的稳定原型层。

---

## T4：可选 embedding 扩展评估

### T4-1 评估 embedding 默认启用前提

**目标**

确认 embedding 对超长篇确实带来稳定增益，而不是只增加复杂度。

**任务**

1. 对比 rule baseline 与 embedding 增强结果。
2. 评估噪声、延迟和收益。
3. 产出是否默认启用的明确判断标准。

**涉及位置**

- `src/domain/planning/retrieval-service-factory.ts`
- `src/domain/planning/embedding-index.ts`
- `src/config/env.ts`
- benchmark 相关测试

**完成标准**

1. 是否默认启用 embedding 有数据支撑。
2. 没有 benchmark 收益时，不推进默认切换。

---

### T4-2 按 `event -> fact -> segment` 顺序评估 embedding 扩展

**目标**

让 embedding 逐步从实体级增强走向章节因果链增强。

**任务**

1. 试点 `story_events` 语义检索。
2. 试点 `retrieval_facts` 语义检索。
3. 试点 `chapter_segments` 语义检索。
4. 逐层记录收益、噪声和成本。

**涉及位置**

- `src/domain/planning/embedding-index.ts`
- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/types.ts`

**完成标准**

1. event / fact / segment 哪一层最值得先扩展有明确结论。
2. 不会在没有对比数据的情况下扩大 embedding 覆盖面。

---

## T5：验证、抽样与收尾

### T5-1 补回归测试与 long-form benchmark

**目标**

把 `v4.2` 的收益锁进自动化验证。

**任务**

1. 增加 sidecar surfacing 相关测试。
2. 增加 section budget 调整相关测试。
3. 增加 long-tail 保留策略测试。
4. 增加 chapter / arc memory 接线测试。
5. 增加 embedding 可选扩展对比 benchmark。

**涉及位置**

- `test/` 目录下相关测试

**完成标准**

1. `v4.2` 的关键升级都有自动化覆盖。
2. 后续继续推进 `v4` 时能及时发现退化。

---

### T5-2 真实书籍抽样验证

**目标**

确认改动不仅 benchmark 变好，也真实改善超长篇连续性。

**任务**

1. 选 1 本中长篇样本做验证。
2. 选 1 本更长样本做验证。
3. 重点检查：
   - 远距离旧承诺回收
   - 未收束旧事件承接
   - 跨 arc 钩子再浮现
   - 长期人物状态与世界规则延续
4. 记录失败样本并回灌 benchmark。

**完成标准**

1. 真实样本中的长距离连续性问题下降。
2. benchmark 结论与真实书籍观察基本一致。

---

## 推荐执行顺序

建议按下面顺序推进：

1. T0-1
2. T0-2
3. T0-3
4. T1-1
5. T1-2
6. T1-3
7. T1-4
8. T2-1
9. T2-2
10. T2-3
11. T3-1
12. T3-2
13. T3-3
14. T3-4
15. T4-1
16. T4-2
17. T5-1
18. T5-2

---

## 建议第一批落地任务

如果现在就要开工，我建议先只做下面 6 项：

1. T0-2：建立超长篇 benchmark 分组
2. T0-3：增加 prompt 裁剪与记忆丢失观测
3. T1-1：提高 persisted facts / events 选择上限
4. T1-2：提高 `plan` prompt context budget
5. T1-3：重调 section 预算优先级
6. T1-4：强化 long-tail 保留策略

原因：

1. 这 6 项都属于最小改动高收益。
2. 它们直接对应 `v4.2` 最核心的问题，也就是“长期记忆不是没有，而是排不进去”。
3. 先把窗口、预算、裁剪、观测校准，再做 sidecar 强化和章节级记忆，风险更低。

---

## Definition of Done

这份任务拆分完成，不代表 `v4.2` 已完成。`v4.2` 真正完成的标准是：

1. 超长篇里高风险旧事实更稳定进入最终 `plan` prompt。
2. 未收束旧事件的影响更稳定进入最终 `plan` prompt。
3. sidecar 不再只是辅助层，而是稳定承担超长篇长期记忆职责。
4. 系统不再主要依赖最近章节窗口碰运气承接跨章、跨 arc 连续性。
5. 章节级 / arc 级记忆已有最小可用入口。
6. 对为什么命中、为什么被裁掉、为什么没进 prompt，有清楚解释链。
7. 保持现有 workflow 与 `retrieved_context` 兼容，不做大爆炸式重写。
