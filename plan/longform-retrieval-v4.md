# 长篇小说检索升级计划（v4）

## 目标

将当前的 planning retrieval 升级为可支撑超长篇中文小说的检索体系，目标规模大致为：

- 100 万字以上
- 1000-3000 章
- 角色众多、关系复杂
- 回收链路深、伏笔跨度大
- 长距离连续性与状态追踪要求高

升级过程中，应保留当前项目最有价值的架构决策：

1. 检索发生在 `plan` 阶段；
2. 生成的 `retrieved_context` 会被持久化；
3. 后续 `draft / review / repair / approve` 复用这份共享上下文。

---

## 当前仓库里的真实约束

从现有实现看，这套系统对中短篇和中等规模长篇是成立的，但对 1000-3000 章级别的超长篇还不够。

### 当前应该保留的部分

1. `plan` 是统一检索入口。
2. `retrieved_context` 是后续阶段共享上下文。
3. 规则召回仍然是稳定基线。
4. embedding 检索应该继续作为增强层，而不是替代规则召回。

### 当前阻碍超长篇扩展的部分

1. **检索主体仍然以“整实体”为主**  
   现在 embedding 基本还是“一条实体一份摘要文档”，而不是事实、事件、章节片段级别。

2. **缺少章节级 / 事件级语义检索**  
   目前只能回看少量最近章节摘要，无法对旧章节片段或旧事件做真正的语义召回。

3. **召回预算和 prompt 预算都偏小**  
   当前参数更像是为中小体量书设计的，不适合 1000+ 章连续性。

4. **当前 merge 身份仍偏实体级**  
   现在很多逻辑是基于 `entityType + entityId` 合并，而长篇连续性更需要“原子事实”和“事件节点”的稳定身份。

5. **embedding 语料目前是服务构建时临时拼出来的**  
   当前 retrieval service 创建时，会从 DB 读取当前书籍实体并构造 in-memory embedding 语料。对小中型书可行，但对超长篇不够稳健。

---

## 目标架构

长篇检索应该升级成 **多层检索系统**：

1. **事实层（fact）**：原子连续性事实
2. **事件层（event）**：章节或剧情节点级事件
3. **章节片段层（chapter segment）**：可语义检索的章节切片
4. **实体层（entity）**：保留，但不再是唯一语义单位

检索流程应改成 **自底向上**：

1. 从 query intent 出发
2. 先召回 fact / event
3. 再按需要扩展到实体 / 章节背景
4. 最终做预算驱动的 prompt 装配

这才是支撑百万字长篇的核心结构变化。

---

## 分阶段实施

## Phase 0：先补 benchmark 与 observability

### 目标

在改数据结构前，先让系统具备“看见失败”的能力。

### 为什么必须先做

如果没有长篇 benchmark，后续任何 retrieval 改造都很难判断是变好了，还是只是“换了一种错法”。

### 交付物

1. 增加长篇检索 benchmark fixture，覆盖：
   - 长距离连续性召回
   - 50 / 100 / 300+ 章之后的 callback 回收
   - 人物动机连续性
   - 世界规则再浮现
   - spoiler-safe retrieval
   - 同主题高密度实体的歧义消解

2. 增加 observability 指标：
   - queryText 长度
   - 各层召回数量
   - rerank 前后丢弃数量
   - prompt 各 section 的预算占用
   - embedding-only 召回率
   - hard-constraint 保留率

3. 增加规模型 fixture：
   - 300 章
   - 1000 章
   - 3000 章

### 可能涉及的文件

- `test/helpers/retrieval-benchmark.ts`
- `test/integration/retrieval-benchmark.test.ts`
- `src/domain/planning/retrieval-observability.ts`
- 其他 benchmark fixture 所在目录

### 成功标准

1. 可以量化长距离连续性召回质量。
2. 可以对比 legacy retrieval 与新 retrieval，而不是靠主观感觉。

---

## Phase 1：先把现有系统安全拉高一档

### 目标

在不改变持久化模型的前提下，先为长篇争取一些“可用空间”。

### 改动内容

1. 提高规则召回 scan limit 与 top-K。
2. 区分 short-form 和 long-form 配置。
3. 扩大章节承接窗口，不再只盯极少数最近章节摘要。
4. 保持 legacy `retrieved_context` 形状稳定。

### 建议的 long-form 起始参数

下面是起始值，不是最终定值：

```dotenv
PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT=1500
PLANNING_RETRIEVAL_CHARACTER_LIMIT=32
PLANNING_RETRIEVAL_FACTION_LIMIT=20
PLANNING_RETRIEVAL_ITEM_LIMIT=20
PLANNING_RETRIEVAL_HOOK_LIMIT=24
PLANNING_RETRIEVAL_RELATION_LIMIT=32
PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT=20
PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT=8
PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER=12
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC=32
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_HYBRID=40
```

### 重要说明

这一阶段只是“扩容量”，并没有解决根问题。根问题是：当前 still 是“一实体一语义文档”。

### 可能涉及的文件

- `src/config/env.ts`
- `.env.example`
- `docs/env-config-guide.md`
- `src/domain/planning/retrieval-candidate-provider-rule.ts`
- `src/domain/planning/retrieval-service.ts`

### 成功标准

1. 系统不再因为 scan limit 太小而在中大规模书上明显失真。
2. 不需要 schema migration。
3. 现有 workflow 不被破坏。

---

## Phase 2：引入持久化 retrieval storage

### 目标

把当前临时拼出来的 embedding 语料，升级为可持久化、可增量更新、可回填的 retrieval corpus。

### 为什么这一阶段是必须的

如果要支撑百万字级项目，检索语料必须变成基础设施，而不是运行时临时组装的内存对象。

### 建议新增的数据结构

1. `retrieval_documents`
   - `id`
   - `book_id`
   - `entity_type`
   - `entity_id`
   - `layer`（`entity` / `fact` / `event` / `chapter_segment`）
   - `chunk_key`
   - `chapter_no`
   - `payload_json`
   - `text`
   - `embedding_model`
   - `embedding_vector_ref` 或其他向量存储字段
   - timestamps

2. `retrieval_facts`
   - 原子连续性事实
   - 稳定 fact identity
   - 来源章节
   - 来源实体 / 事件链接
   - fact type
   - importance / risk level
   - active / superseded 状态

3. `story_events`
   - 事件摘要
   - 所属章节
   - 参与方
   - 地点
   - 前置依赖
   - 结果
   - hook 引用

4. `chapter_segments`
   - `chapter_id`
   - `segment_index`
   - semantic text
   - event links
   - 必要时预留 spoiler-safe flags

### 必须具备的能力

1. 增量刷新
2. 可回填 backfill
3. 与 legacy path 双读兼容
4. 默认按 `book_id` 作用域隔离

### 可能涉及的文件

- `src/core/db/schema/` 下的 schema 与 migration
- `src/core/db/repositories/` 下的 repository
- `src/domain/planning/embedding-store.ts`
- `src/domain/planning/embedding-refresh.ts`
- `src/domain/planning/retrieval-service-factory.ts`

### 成功标准

1. retrieval corpus 不再依赖 service 创建时的全量内存重建。
2. 长篇书籍可以做可恢复的 backfill 与增量 refresh。

---

## Phase 3：升级为事实级 / 事件级检索

### 目标

让语义检索作用在“连续性原子单位”上，而不是只作用在整实体上。

### 核心改动

1. 把一实体一文档升级为多文档索引：
   - character:state
   - character:goal
   - character:location
   - character:relationship-relevant-note
   - item:ownership
   - item:status
   - relation:status
   - relation:tension
   - world_setting:rule
   - world_setting:boundary
   - hook:setup
   - hook:expected_payoff

2. 增加事件级文档：
   - event:summary
   - event:outcome
   - event:participants
   - event:unresolved-impact

3. 增加章节片段文档：
   - 对旧章节内容或章节摘要切成可语义检索的片段

### 检索策略

1. 先召回 facts / events。
2. 只有在多个命中共同支持时，才扩展到 entity / chapter background。
3. 在 `retrieved_context` 中保留 fact identity，而不是只保留实体 identity。

### 可能涉及的文件

- `src/domain/planning/embedding-index.ts`
- `src/domain/planning/embedding-text.ts`
- 新增的 fact/event builder 模块
- `src/domain/planning/embedding-types.ts`

### 成功标准

1. 系统能召回“当前位置 / 归属 / 规则边界 / 旧事件后果”，而不是只能召回整人物摘要。
2. 当实体数变大时，召回质量仍然稳定。

---

## Phase 4：改造成分层检索流水线

### 目标

把“单次大杂烩检索”升级为多阶段 retrieval pipeline。

### 建议流水线

1. **Intent extraction**
   - 保留当前结构化提取
   - 增加更适合长篇的字段：timeline cues、unresolved callbacks、relationship cues、rule-surface cues

2. **Stage A：廉价 lexical / business retrieval**
   - rule-based candidates
   - manual refs
   - exact IDs
   - chapter proximity

3. **Stage B：semantic fact / event recall**
   - 查询 retrieval documents 中的 facts / events / chapter segments

4. **Stage C：扩展**
   - 根据 top facts / events 扩展 supporting entities / chapters

5. **Stage D：rerank**
   - continuity risk
   - recency
   - chapter distance
   - manual focus
   - rule criticality

6. **Stage E：prompt budget allocation**
   - blocking facts first
   - recent event chain second
   - supporting entities third
   - chapter background last

### 可能涉及的文件

- `src/domain/planning/retrieval-pipeline.ts`
- `src/domain/planning/retrieval-service.ts`
- `src/domain/workflows/plan-chapter-workflow.ts`
- reranker 与 observability 模块

### 成功标准

1. retrieval 输出变得分层、可解释。
2. 老章节材料可以被重新唤回，但不会把 prompt 淹没。

---

## Phase 5：面向长篇的预算驱动 prompt 装配

### 目标

让 prompt assembly 消费“分层召回结果”，而不是直接平铺大量结果。

### 改动内容

1. 保留当前分 section 的上下文设计。
2. 改为优先消费：
   - must-follow facts
   - recent event chain
   - critical unresolved hooks
   - core active state changes
   - optional supporting chapter context

3. 为 long-form mode 单独设计 per-section 预算策略。
4. 保留 compact machine-readable retrieval snapshot，方便 debug。

### 推荐装配顺序

1. hard constraints / blocking facts
2. continuity-critical state changes
3. unresolved event chain
4. near-term hook obligations
5. minimal supporting world/entity background

### 可能涉及的文件

- `src/domain/planning/prompt-context-blocks.ts`
- `src/domain/planning/prompts.ts`
- `src/domain/planning/context-views.ts`

### 成功标准

1. prompt 预算优先留给连续性关键单元。
2. 老章节背景只在必要时才被带入。

---

## Phase 6：回填、灰度与兼容

### 目标

在不打断现有 workflow 的前提下完成升级。

### rollout 策略

1. **Dual-write**
   - 保留 legacy retrieval 输出
   - 同时写入新 retrieval artifacts

2. **Dual-read flag**
   - 初期默认走旧路径
   - 新 long-form retrieval 由 feature flag 控制

3. **Backfill job**
   - 为旧书生成 retrieval facts / events / chapter segments
   - 要求可恢复、幂等

4. **Book-level enablement**
   - 支持按 book 开启长篇 retrieval

5. **Cutover**
   - 只有 benchmark 通过并经过真实长篇手工验证后才切换默认值

### 兼容原则

在新 retrieval pipeline 引入期间，当前各阶段对 `retrieved_context` 的消费逻辑应继续可用，必要时通过 compatibility adapter 过渡。

### 可能涉及的文件

- workflow config 与 env flags
- retrieval factory
- `src/cli/commands/` 下的回填命令

### 成功标准

1. 现有书籍继续可用。
2. 新长篇书籍可以按 book 启用更强检索。
3. 迁移过程可回退。

---

## 推荐实施顺序

1. Phase 0：benchmark 与 observability
2. Phase 1：参数扩容与长篇 preset
3. Phase 2：persistent retrieval storage
4. Phase 3：fact / event / chapter-segment indexing
5. Phase 4：hierarchical retrieval pipeline
6. Phase 5：prompt assembly upgrade
7. Phase 6：rollout 与 cutover

---

## 哪些是“立刻可做”，哪些是“必须做”

## 立刻可做 / 低风险

1. 提高 scan cap 和 top-K
2. 增加 long-form env preset
3. 增加 observability 和 benchmark
4. 增大 recent chapter carryover window

## 必须做 / 结构性升级

1. persistent retrieval storage
2. fact identity 与 fact-level retrieval
3. event 与 chapter-segment semantic indexing
4. hierarchical retrieval
5. 基于 layered retrieval 的 prompt assembly

如果项目真的要支撑 1000-3000 章，这些结构项都不是可选项。

---

## 需要尽早定下来的产品 / 工程决策

1. **长篇模式的主生产数据库**  
   建议把 **MySQL 视为百万字项目的主生产后端**，SQLite 保留为小书和本地开发兼容模式。

2. **Backfill 时机**  
   要决定旧书是统一回填，还是只在启用 long-form mode 时按需回填。

3. **Spoiler boundary policy**  
   如果未来会扩展读者视角功能，retrieval metadata 需要预留 spoiler-safe 控制。

4. **Embedding storage format**  
   要决定向量是继续 provider 管理 / 内存管理，还是转向更耐久的存储方式。

---

## 推荐的第一段交付切片

如果希望以最稳妥的方式启动，我建议从下面这条链路开始：

1. 增加长篇 retrieval benchmark。
2. 增加 long-form env preset 并拉高限制。
3. 增加 `retrieval_documents`、`retrieval_facts`、`story_events`、`chapter_segments` 的 schema。
4. 构建 backfill / index refresh pipeline，并放在 feature flag 后面。
5. 增加 dual-read retrieval path。
6. 等 retrieval artifacts 稳定后，再升级 prompt assembly。

这是最小但方向正确的结构升级路径，能避免 big-bang rewrite。

---

## 完成定义（Definition of Done）

只有当以下条件都成立时，才算长篇 retrieval 升级完成：

1. 1000+ 章书籍可以可靠召回长距离连续性事实。
2. retrieval 不再依赖“一实体一摘要文档”。
3. 旧章节 / 旧事件的召回是语义级的，而不是只靠最近章节摘要。
4. prompt 装配在预算受限时仍能优先保住连续性关键事实。
5. benchmark 证明 recall 改善且无明显回归。
6. legacy 书籍在 rollout 期间继续可用。
