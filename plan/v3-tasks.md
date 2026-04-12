# AI 小说工具 V3 执行清单

> 对应总方案：[`v3.md`](./v3.md)

## 使用说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- 推荐按 P0 -> P1 -> P2 -> P3 -> P4 顺序推进

---

## P0. V3 基线与评测集

> 目标：先量化当前 V2 的召回与 prompt 表现，避免 V3 变成纯主观调参。

### P0-1. 固定 benchmark 范围
- [ ] 选出 20 到 50 个真实章节案例
- [ ] 覆盖 `plan / draft / review / approve diff` 相关场景
- [ ] 覆盖人物、势力、物品、关系、钩子、世界设定六类实体

### P0-2. 标注关键事实
- [ ] 为每个案例标注必须召回的 `blocking facts`
- [ ] 标注最近状态变更
- [ ] 标注常见连续性错误类型
- [ ] 标注可接受的补充背景范围

### P0-3. 建立评测指标
- [ ] 增加 `Constraint Recall@N`
- [ ] 增加 `Important Entity Recall@N`
- [ ] 增加 `Noise Ratio`
- [ ] 增加 `Continuity Error Rate`
- [ ] 增加 `Approve Diff Precision`

**完成定义**
- [ ] 当前 V2 基线结果已可复跑
- [ ] 后续每次召回和 prompt 改动都可以对照评估

---

## P1. 召回数据结构升级

> 目标：把“实体列表”升级成“适合 prompt 消费的事实包”。

### P1-1. 设计 V3 事实包结构
- [ ] 盘点当前 `RetrievedEntity` 的不足
- [ ] 设计 `entitySummary`
- [ ] 设计 `currentState`
- [ ] 设计 `recentChanges`
- [ ] 设计 `continuityRisk`
- [ ] 设计 `relevanceReasons`
- [ ] 定义 `RetrievedFactPacket` 类型草案

### P1-2. 设计重要性分层
- [ ] 增加 `blockingConstraints`
- [ ] 增加 `decisionContext`
- [ ] 增加 `supportingContext`
- [ ] 增加 `backgroundNoise`
- [ ] 明确其与 `hardConstraints` / `softReferences` 的关系
- [ ] 定义 `RetrievedPriorityContext` 类型草案

### P1-3. 最近状态与最后变更
- [ ] 识别最近 1 到 3 章出现过的关键实体
- [ ] 识别位置、关系、物品归属、钩子状态的最近变更
- [ ] 将最近变更接入高优先级召回

### P1-4. 代码文件映射
- [ ] 新建 `retrieval-facts.ts`
- [ ] 新建 `retrieval-priorities.ts`
- [ ] 新建 `recent-changes.ts`
- [ ] 保持 `retrieval-service.ts` 只做 orchestration

**完成定义**
- [ ] Prompt 不再依赖原始字段拼接来理解关键状态
- [ ] 最近变更可单独展示并稳定进入高优先级上下文

---

## P2. 召回规则升级

> 目标：从“字段命中”升级为“意图槽位 + 重要性 + 风险”联合召回。

### P2-1. 意图槽位解析
- [ ] 在关键词提取之外增加 `subjectEntities`
- [ ] 增加 `goalAndConflict`
- [ ] 增加 `locationAndScene`
- [ ] 增加 `plotThreads`
- [ ] 增加 `forbiddenMoves`

### P2-2. 各实体类型规则细化
- [ ] 人物按身份、当前状态、目标、地点细化权重
- [ ] 势力按控制范围、核心目标、当前立场细化权重
- [ ] 物品按归属、能力、稀有性、状态细化权重
- [ ] 关系按两端实体、关系类型、最近变更细化权重
- [ ] 钩子按状态、兑现窗口、铺垫深度细化权重
- [ ] 世界设定按规则边界、代价、禁忌细化权重

### P2-3. 负面召回与禁止漂移规则
- [ ] 设计 `doNotInvent`
- [ ] 设计 `doNotOverride`
- [ ] 设计 `doNotEscalate`
- [ ] 将其接入世界规则、人物能力、关系状态等高风险域

### P2-4. 新打分模型
- [ ] 拆出 `matchScore`
- [ ] 拆出 `importanceScore`
- [ ] 拆出 `continuityRiskScore`
- [ ] 拆出 `recencyScore`
- [ ] 拆出 `manualPriorityScore`
- [ ] 定义最终排序和保底保留规则

**完成定义**
- [ ] 高风险信息的稳定性高于弱相关长文本
- [ ] 重要性分层能显著降低 prompt 噪声

---

## P3. Prompt 输入重组与指令优化

> 目标：把整理后的关键事实以更易执行的形式交给模型。

### P3-1. 重组上下文块
- [ ] 增加 `本章必须遵守的事实`
- [ ] 增加 `最近承接的变化`
- [ ] 增加 `本章核心人物/势力/关系`
- [ ] 增加 `必须推进的钩子`
- [ ] 增加 `禁止改写与禁止新增`
- [ ] 增加 `补充背景`
- [ ] 定义 `PromptContextBlocks` 类型草案
- [ ] 新建 `prompt-context-blocks.ts`

### P3-2. 分阶段 prompt 改造
- [ ] `buildPlanPrompt()` 改成目标 + 约束 + 风险三段式
- [ ] `buildDraftPrompt()` 先展示硬约束，再展示剧情上下文
- [ ] `buildReviewPrompt()` 改成缺陷分类导向
- [ ] `buildRepairPrompt()` 强化“只修关键问题，不扩写设定”
- [ ] `buildApprovePrompt()` 强化正式约束与继承关系
- [ ] `buildApproveDiffPrompt()` 强化“只抽取真实可回写变更”

### P3-3. Prompt 优先级与 token 预算
- [ ] 明确 `blockingConstraints > recentChanges > decisionContext > supportingContext`
- [ ] 为不同阶段设置上下文预算
- [ ] 超预算时优先丢弃背景层，不丢弃高风险约束

**完成定义**
- [ ] Prompt 里的关键事实密度明显提升
- [ ] review 输出更聚焦真实缺陷
- [ ] approve diff 的误抽取率下降

---

## P4. rerank / embedding 实验接入

> 目标：在不破坏主召回稳定性的前提下，为语义召回和精排建立实验链路。

### P4-1. Heuristic rerank
- [ ] 实现基于阶段、风险、最近变更的本地 reranker
- [ ] 支持对 `plan / draft / review` 使用不同重排策略

### P4-2. Embedding candidate provider
- [ ] 定义 `EmbeddingProvider`
- [ ] 设计统一的 embedding 摘要结构：`identity/currentState/coreConflictOrGoal/recentChanges/continuityRisk`
- [ ] 新建 `embedding-types.ts`
- [ ] 新建 `embedding-text.ts` 作为统一导出层
- [ ] 为 `characters` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `factions` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `items` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `relations` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `hooks` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `world_settings` 设计可读的 embedding 字段映射和摘要模板
- [ ] 为 `chapters/plans/finals` 设计承接型 embedding 摘要模板
- [ ] 明确每类实体哪些字段禁止进入 embedding
- [ ] 把“摘要构造”和“向量生成”拆成独立模块，避免混在 retrieval service 里
- [ ] 让 embedding 只补充候选，不直接替代规则召回

### P4-2a. MVP 第一阶段
- [ ] 先只实现 `characters` 的 embedding 摘要构造
- [ ] 先只实现 `hooks` 的 embedding 摘要构造
- [ ] 先只实现 `world_settings` 的 embedding 摘要构造
- [ ] 验证这三类实体的摘要长度、可读性和 explainability

### P4-2b. MVP 第二阶段
- [ ] 补 `relations` 的 embedding 摘要构造
- [ ] 补 `items` 的 embedding 摘要构造
- [ ] 补 `factions` 的 embedding 摘要构造

### P4-2c. MVP 第三阶段
- [ ] 补 `chapters/plans/finals` 的承接型 embedding 摘要
- [ ] 接入 `EmbeddingCandidateProvider`
- [ ] 完成规则候选和语义候选 merge

### P4-3. Embedding indexing 与存储
- [ ] 设计向量存储层接口，不让 retrieval service 直接依赖底层存储细节
- [ ] 设计按实体类型刷新 embedding 的流程
- [ ] 设计按模型版本刷新 embedding 的流程
- [ ] 设计 query 文本的摘要化规则
- [ ] 设计语义候选与规则候选的去重和 explainability 合并规则
- [ ] 新建 `embedding-provider.ts`
- [ ] 新建 `embedding-candidate-provider.ts`

### P4-4. 对照实验
- [ ] 对比 `规则召回`
- [ ] 对比 `规则召回 + heuristic rerank`
- [ ] 对比 `规则召回 + embedding 候选 + rerank`
- [ ] 增加 `retrieval-benchmark.test.ts`
- [ ] 增加 `test/fixtures/retrieval-benchmark/` 固定样本

**完成定义**
- [ ] 默认主链路不依赖 embedding
- [ ] 实验链路可通过 benchmark 量化收益
- [ ] embedding 摘要构造代码按实体拆分，具备良好可读性
- [ ] embedding 相关字段选择在 plan 和代码实现中保持一致

---

## 全量完成定义（DoD）

- [ ] V3 benchmark 已建立并可复跑
- [ ] 召回结果已从实体列表升级为面向 prompt 的事实包
- [ ] 最近状态变化与高风险约束具备保底保留机制
- [ ] prompt 已改为“关键事实块 + 分阶段职责”结构
- [ ] 端到端连续性错误率相对 V2 有明确下降
- [ ] rerank / embedding 已具备可实验入口但不破坏默认稳定性
