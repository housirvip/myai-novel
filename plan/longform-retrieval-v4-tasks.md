# 长篇小说检索升级任务拆分（v1）

> 对应总计划：`plan/longform-retrieval-v4.md`

这份文档不是架构说明，而是面向实施的任务拆分。目标是把长篇小说检索升级拆成可执行、可验证、可分阶段交付的工作包。

---

## 总体执行原则

1. 先补 benchmark 和 observability，再做结构升级。
2. 先做兼容层，再做切换，不做一次性重写。
3. 每一阶段都要求：
   - 可单独验证
   - 可回退
   - 不破坏现有 workflow

---

## 任务分组总览

1. T0：基线与观测
2. T1：参数扩容与长篇 preset
3. T2：持久化 retrieval storage
4. T3：事实 / 事件 / 章节片段建模
5. T4：索引刷新与回填链路
6. T5：分层检索流水线
7. T6：prompt 装配升级
8. T7：灰度、切换与收尾

---

## T0：基线与观测

### T0-1 补长篇 retrieval benchmark fixture

**目标**

建立能稳定复现长篇召回问题的测试样本。

**任务**

1. 增加长距离连续性 fixture
2. 增加 callback 回收 fixture
3. 增加高密度人物 / 势力 / 关系冲突 fixture
4. 增加规则边界再浮现 fixture
5. 增加 spoiler-safe fixture（如后续需要）

**涉及位置**

- `test/helpers/retrieval-benchmark.ts`
- `test/integration/retrieval-benchmark.test.ts`

**完成标准**

1. 能区分短篇检索正确和长篇检索失败。
2. 可以用于对比 legacy 与新方案。

---

### T0-2 补 retrieval observability

**目标**

让每次 planning retrieval 的行为可观测。

**任务**

1. 记录 queryText 长度
2. 记录各层召回数量
3. 记录 rerank 前后丢弃量
4. 记录硬约束保留率
5. 记录 prompt section 预算使用量

**涉及位置**

- `src/domain/planning/retrieval-observability.ts`
- `src/domain/planning/retrieval-service.ts`

**完成标准**

1. 观察日志可以回答“为什么没召回出来”。
2. 预算压缩后的信息损耗可量化。

---

## T1：参数扩容与长篇 preset

### T1-1 新增长篇 preset

**目标**

把现有配置从“默认短中篇”扩成“可切换长篇模式”。

**任务**

1. 增加 long-form 相关 env 参数文档
2. 提高 scan limit
3. 提高 per-type top-K
4. 提高 embedding top-K
5. 拉大 recent chapter scan window

**涉及位置**

- `src/config/env.ts`
- `.env.example`
- `docs/env-config-guide.md`

**完成标准**

1. 可以通过 env 切到更适合长篇的参数。
2. 不需要 schema migration。

---

### T1-2 校准现有规则召回上限

**目标**

先把现有 rule retrieval 的上限调到“不至于太早丢上下文”。

**任务**

1. 提高 `ENTITY_SCAN_LIMIT`
2. 调整 characters / relations / hooks 等上限
3. 校对 hard-constraints 在大样本下是否过于激进

**涉及位置**

- `src/domain/planning/retrieval-candidate-provider-rule.ts`
- `src/domain/planning/retrieval-hard-constraints.ts`

**完成标准**

1. 中大型书籍不会因为 200 行上限过早失真。

---

## T2：持久化 retrieval storage

### T2-1 设计并落库 retrieval_documents

**目标**

引入统一 retrieval document 容器。

**任务**

1. 定义表结构
2. 增加 migration
3. 增加 repository
4. 定义 document layer 枚举：`entity / fact / event / chapter_segment`

**涉及位置**

- `src/core/db/schema/`
- `src/core/db/repositories/`

**完成标准**

1. 能持久化 retrieval 文档，而不是只放在内存里。

---

### T2-2 定义 retrieval_facts / story_events / chapter_segments

**目标**

为长篇检索建立基础结构。

**任务**

1. 设计三张表字段
2. 定义主键 / 外键 / book scope
3. 定义有效期 / supersede / active 状态
4. 明确和 chapter / entity 的关联方式

**完成标准**

1. 可以表达“这条事实仍然有效”。
2. 可以表达“这个事件仍在影响现在”。

---

## T3：事实 / 事件 / 章节片段建模

### T3-1 定义 fact taxonomy

**目标**

把连续性拆成原子事实类型。

**任务**

1. 列出人物相关 fact type
2. 列出关系相关 fact type
3. 列出道具相关 fact type
4. 列出世界规则相关 fact type
5. 列出 hook 状态相关 fact type

**完成标准**

1. 每条连续性错误都能映射到一个或多个 fact type。

---

### T3-2 定义 event schema

**目标**

让剧情节点可以作为检索对象存在。

**任务**

1. 定义 event summary
2. 定义 participants
3. 定义 outcome
4. 定义 unresolved impact
5. 定义 hook links

**完成标准**

1. 旧剧情节点可以被语义检索召回。

---

### T3-3 定义 chapter segment 规则

**目标**

让旧章节内容可以被分片检索，而不是只能靠最近摘要。

**任务**

1. 定义分片粒度
2. 定义 segment metadata
3. 定义和 event / fact 的链接关系
4. 定义 segment 的回填来源（正文 / 摘要 / 历史版本）

**完成标准**

1. 老章节的语义信息能被稳定检索。

---

## T4：索引刷新与回填链路

### T4-1 改造 embedding refresh 流程

**目标**

让 refresh 不再只面向 entity summary，而是支持多层文档。

**任务**

1. 扩展 document builder
2. 支持 layer 级 refresh
3. 支持按 book 增量刷新
4. 支持按 chapter 范围刷新

**涉及位置**

- `src/domain/planning/embedding-refresh.ts`
- `src/domain/planning/embedding-index.ts`

**完成标准**

1. fact / event / chapter segment 都可进入 refresh。

---

### T4-2 增加 backfill 命令

**目标**

支持旧书生成新 retrieval corpus。

**任务**

1. 增加 CLI backfill 命令
2. 支持按 book backfill
3. 支持断点恢复
4. 支持幂等执行

**涉及位置**

- `src/cli/commands/`

**完成标准**

1. 旧书可从 legacy 数据回填出新检索层。

---

## T5：分层检索流水线

### T5-1 扩展 retrieval query payload

**目标**

让 intent extraction 更适配长篇检索。

**任务**

1. 增加 timeline cues
2. 增加 unresolved callback cues
3. 增加 relation / tension cues
4. 增加 world-rule resurfacing cues

**涉及位置**

- `src/domain/workflows/plan-chapter-workflow.ts`
- `src/domain/planning/prompts.ts`

**完成标准**

1. query payload 可以驱动 fact / event / segment 三级召回。

---

### T5-2 增加 semantic fact / event recall

**目标**

让检索先召回真正的连续性核心单元。

**任务**

1. 新增 retrieval layer candidate provider
2. 先召回 facts
3. 再召回 events
4. 视情况扩展 supporting entities / segments

**完成标准**

1. 查询“当前状态 / 旧承诺 / 老伏笔”时优先打中 facts/events，而不是整实体摘要。

---

### T5-3 改造 rerank 逻辑

**目标**

让 rerank 真正体现长篇连续性的优先级。

**任务**

1. 提高 blocking fact 权重
2. 提高 unresolved event 权重
3. 引入 chapter distance 权重
4. 引入 recency 与 continuity risk 权重
5. 引入 manual focus 与 hard-constraint 优先级

**完成标准**

1. 排序结果更贴近“写这一章最怕写错什么”。

---

## T6：prompt 装配升级

### T6-1 新增 layered context block 结构

**目标**

让 prompt 消费的是“分层检索结果”，而不是简单平铺结果列表。

**任务**

1. 设计 must-follow facts block
2. 设计 recent event chain block
3. 设计 unresolved hooks block
4. 设计 active state changes block
5. 设计 optional supporting background block

**涉及位置**

- `src/domain/planning/prompt-context-blocks.ts`
- `src/domain/planning/prompts.ts`

**完成标准**

1. prompt 预算优先给连续性关键内容。

---

### T6-2 增加长篇模式预算策略

**目标**

为 long-form mode 单独定义预算分配。

**任务**

1. 设定 plan / draft / review / repair 的不同预算
2. 控制 section 内最小保留数
3. 控制 fallback 行为
4. 增加预算使用 observability

**完成标准**

1. 老章节背景不会淹没当前关键事实。

---

## T7：灰度、切换与收尾

### T7-1 增加 dual-read / dual-write 开关

**目标**

新旧 retrieval path 可以并行存在。

**任务**

1. 增加 feature flag
2. 支持按 book 切换
3. 支持 legacy / long-form 结果对比

**完成标准**

1. 新路径可以灰度，不需要一次性切换全量。

---

### T7-2 真实书籍验证

**目标**

在真实长篇样本上做人工验证。

**任务**

1. 选 1 本中型书做试点
2. 选 1 本超长篇书做试点
3. 验证 callback、关系延续、规则延续、长距离事件影响
4. 记录失败样例并补 benchmark

**完成标准**

1. benchmark 与真实书籍结论一致。

---

## 推荐执行顺序

建议按下面顺序实施：

1. T0-1
2. T0-2
3. T1-1
4. T1-2
5. T2-1
6. T2-2
7. T3-1
8. T3-2
9. T3-3
10. T4-1
11. T4-2
12. T5-1
13. T5-2
14. T5-3
15. T6-1
16. T6-2
17. T7-1
18. T7-2

---

## 建议第一批落地任务

如果要马上开工，建议第一批只做下面 6 项：

1. T0-1：补 benchmark
2. T0-2：补 observability
3. T1-1：增加 long-form preset
4. T1-2：扩大当前 scan limit / top-K
5. T2-1：加 `retrieval_documents`
6. T2-2：加 `retrieval_facts / story_events / chapter_segments`

原因：

- 这批任务改动方向正确；
- 不会太早卷入 prompt 装配复杂度；
- 能尽快把长篇升级从“想法”推进到“具备基础设施”。

---

## Definition of Done

这份任务拆分完成，不代表项目完成。真正的完成标准是：

1. 1000+ 章长篇可以稳定召回长距离连续性事实；
2. 旧章节 / 旧事件可以被语义召回；
3. prompt 能优先消费连续性关键单元；
4. 新旧路径可以灰度切换；
5. benchmark 和真实样本都证明升级有效。
