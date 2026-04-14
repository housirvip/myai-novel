# 日志、测试与项目结构

本文整理 `myai-novel` 当前与工程维护相关的说明，包括日志体系、测试命令与覆盖范围、项目结构，以及当前版本状态。

## 目录

- [1. 日志](#1-日志)
- [2. 测试](#2-测试)
- [3. 项目结构](#3-项目结构)
- [4. 当前状态](#4-当前状态)
- [相关阅读](#相关阅读)

## 1. 日志

日志默认会：

- 输出到终端
- 写入 `LOG_DIR` 指定目录

重点配置：

- `LOG_LEVEL`
- `LOG_FORMAT`
- `LOG_LLM_CONTENT_ENABLED`
- `LOG_LLM_CONTENT_MAX_CHARS`

系统会记录：

- 所有数据表增删改查日志
- `plan / draft / review / repair / approve` 工作流耗时
- LLM 调用的 provider、model、耗时、成功与否

## 2. 测试

常用测试与检查命令：

```bash
npm run check
npm run build
npm test
```

当前测试覆盖：

- 配置解析
- logger 内容开关
- CLI 参数与关键词校验
- `RelationRepository` CRUD
- LLM factory
- `parseLooseJson`
- mock 工作流全链路
- Markdown 导入导出版本化
- MySQL 配置解析与 client 创建
- MySQL `db init` / `db check`
- MySQL `plan -> draft -> review -> repair -> approve` 全链路
- MySQL `chapter export/import`
- 召回质量与阶段化 prompt 长度回归
- `priorityContext / recentChanges / relation propagation`
- `HeuristicReranker`
- embedding indexing / memory search / hybrid search
- retrieval benchmark 与 gap 样本实验

## 3. 项目结构

```text
src/
  cli/                CLI 命令入口
  config/             环境变量配置
  core/db/            DB client、dialect、migration、repository
  core/llm/           LLM 抽象、provider、日志
  core/logger/        日志系统
  domain/             业务 service、planning、workflow
  shared/utils/       公共工具
test/                 单元测试与集成测试
plan/                 V2 方案与 checklist
examples/             示例脚本
```

其中当前与 V3 最相关的目录包括：

- `src/domain/planning/`
  - `prompts.ts`：各阶段 prompt 构建
  - `prompt-context-blocks.ts`：可读事实块构造
  - `context-views.ts`：阶段化上下文视图
  - `retrieval-ranking.ts`：规则打分与 explainability
  - `retrieval-features.ts`：priority 与 rerank 共享特征判断
  - `retrieval-pipeline.ts`：候选提供与 rerank 预留接口
  - `retrieval-service.ts`：检索主链 orchestration
  - `retrieval-candidate-provider-rule.ts`：默认规则式 candidate provider
  - `retrieval-service-factory.ts`：embedding 实验链路初始化
  - `retrieval-reranker-factory.ts`：reranker 配置选择
  - `retrieval-context-builder.ts`：最终 `PlanRetrievedContext` 装配
  - `retrieval-hard-constraints.ts`：硬约束筛选
  - `retrieval-risk-reminders.ts`：风险提醒构造
  - `retrieval-facts.ts`：fact packet 入口编排
  - `fact-packet-builder.ts`：fact packet 构造
  - `relation-propagation.ts`：关系传播与 hard-fact 扩展
  - `fact-packet-merge.ts`：packet 合并与去重
  - `retrieval-priorities.ts`：priorityContext 分层
  - `recent-changes.ts`：recentChanges 聚合
  - `retrieval-reranker-heuristic.ts`：启发式 rerank
  - `embedding-*.ts`：embedding 文档、provider、searcher、candidate provider
  - `embedding-store.ts`：embedding 索引存储契约与内存实现
  - `embedding-refresh.ts`：embedding 文档刷新、按类型刷新、按 model 清理流程
- `src/core/db/`
  - `dialects/sqlite.ts`
  - `dialects/mysql.ts`
  - `migrations/initial.ts`
- `test/integration/`
  - SQLite 章节工作流与 Markdown 测试
  - MySQL 真实端到端 workflow 测试

## 4. 当前状态

当前状态：

- 核心表结构与迁移
- 资源 CRUD CLI
- 章节工作流全链路
- 分层召回与阶段化上下文视图
- `priorityContext` / `recentChanges`
- 可读 prompt 事实块
- 正式稿版本化
- 结构化事实回写
- Markdown 导入导出
- SQLite / MySQL 双方言主链验证
- `HeuristicReranker` 已实现并可配置启用
- embedding 实验链路已实现：document / provider / memory search / hybrid search / candidate merge / store / refresh；当前在线接线实体为 `character / hook / world_setting`
- embedding 刷新已支持：全量 refresh / 单一 entityType refresh / 按 model 清理；当前单类型 refresh 范围为 `character | hook | world_setting`
- retrieval benchmark 当前固定 16 个样本已全部收口到 strict
- retrieval query-intent helpers 已开始从 `retrieval-service.ts` 收敛到 `retrieval-features.ts`
- retrieval boost 逻辑已开始从 `retrieval-service.ts` 收敛到 `retrieval-query-boosts.ts`
- retrieval 模块已完成两轮技术债拆分：
  - 第一轮：fact packet builder / relation propagation / merge helper / feature layer
  - 第二轮：candidate provider / reranker factory / service factory / hard constraints / risk reminders / context builder
- `retrieval-service.ts` 当前已明显瘦身，主要负责 provider + reranker 选择、retrieve 编排和 context builder 调用
- 自动化测试基线

如果你想继续往下扩展，下一阶段比较自然的方向通常是：

- 更真实的 embedding provider / 索引刷新流程
- 扩展新的 benchmark gap 样本，继续约束更难的召回缺口
- 更强的关系演化建模
- 冲突检测与设定一致性审计
- 批量章节工作流
- Web UI / 可视化管理端

## 相关阅读

- [`README.md`](../README.md)
- [`docs/README.md`](./README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
- [`docs/embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
