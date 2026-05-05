# 文档索引

## 目录

- [文档列表](#文档列表)
- [推荐阅读顺序](#推荐阅读顺序)
- [与根文档的关系](#与根文档的关系)

这里集中整理 `myai-novel` 当前的核心说明文档，方便从一个入口快速找到需要的内容。

## 文档列表

### 入门

- [`cli-usage-guide.md`](./cli-usage-guide.md)
  - 命令行使用指南
  - 适合查安装、配置、数据库初始化、资源管理、章节工作流、Markdown 导入导出
- [`env-config-guide.md`](./env-config-guide.md)
  - 环境变量配置指南
  - 适合查 `.env` 字段用途、provider 配置、日志配置、数据库配置与召回限制配置

### 工作流专题

- [`chapter-pipeline-overview.md`](./chapter-pipeline-overview.md)
  - 章节全流水线总览
  - 适合先看整体主线、版本表关系、current 指针和状态流转
- [`plan-workflow-guide.md`](./plan-workflow-guide.md)
  - `plan` 工作流详解
  - 适合查 `plan` 命令的输入、两次召回、意图提取、落库流程与后续阶段复用基线
- [`draft-workflow-guide.md`](./draft-workflow-guide.md)
  - `draft` 工作流详解
  - 适合查 `draft` 命令如何复用 plan 固化上下文、如何版本化写入草稿和如何做 pointer 校验
- [`review-workflow-guide.md`](./review-workflow-guide.md)
  - `review` 工作流详解
  - 适合查 `review` 命令的 JSON 输出协议、核对视图、版本化落库与后续修稿衔接
- [`repair-workflow-guide.md`](./repair-workflow-guide.md)
  - `repair` 工作流详解
  - 适合查 `repair` 命令如何基于 `plan + draft + review` 修稿、如何记录版本谱系和更新当前草稿
- [`approve-workflow-guide.md`](./approve-workflow-guide.md)
  - `approve` 工作流详解
  - 适合查 `approve` 命令的双阶段 LLM 调用、dryRun、实体回写、章节字段更新与事务提交逻辑
- [`prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
  - Prompt 与工作流关系说明
  - 适合查各阶段 Prompt 结构、阶段化 context view 和共享上下文消费方式

### 架构与数据

- [`project-architecture-overview.md`](./project-architecture-overview.md)
  - 项目架构总览
  - 适合先看运行入口、分层结构、章节工作流闭环，以及 retrieval / sidecar / 版本表之间的整体关系
- [`database-relationship-overview.md`](./database-relationship-overview.md)
  - 数据库表关系总览
  - 适合查核心表、强外键、软关联、多态引用、章节版本表关系和结构化 JSON 字段
- [`retrieval-pipeline-guide.md`](./retrieval-pipeline-guide.md)
  - Retrieval 全链路详解
  - 适合查 `plan` 阶段从输入、候选获取、embedding 补候选、rerank 到 `retrievedContext` 装配的完整路径
- [`retrieval-sidecar-provenance-guide.md`](./retrieval-sidecar-provenance-guide.md)
  - Retrieval sidecar 与 provenance 说明
  - 适合查 persisted facts/events/documents/segments 如何写入、如何参与 `plan`、以及 `sourceRef/sourceRefs/surfacedIn` 的解释链路
- [`retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
  - 召回与打分规则说明
  - 适合查 `plan` 阶段的召回策略、打分细则、排序规则、实体匹配字段与相关配置项
- [`embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
  - embedding 与 rerank 实现说明
  - 适合查 embedding 文档构造、refresh/store/search 流程、candidate merge、heuristic rerank 与实验链路职责边界

### 工程维护

- [`engineering-overview.md`](./engineering-overview.md)
  - 日志、测试与项目结构
  - 适合查工程维护相关信息、测试命令、日志配置与项目概览

## 推荐阅读顺序

如果你是第一次接触这个项目，建议按下面顺序阅读：

1. [`cli-usage-guide.md`](./cli-usage-guide.md)
2. [`env-config-guide.md`](./env-config-guide.md)
3. [`project-architecture-overview.md`](./project-architecture-overview.md)
4. [`chapter-pipeline-overview.md`](./chapter-pipeline-overview.md)
5. [`plan-workflow-guide.md`](./plan-workflow-guide.md)
6. [`draft-workflow-guide.md`](./draft-workflow-guide.md)
7. [`review-workflow-guide.md`](./review-workflow-guide.md)
8. [`repair-workflow-guide.md`](./repair-workflow-guide.md)
9. [`approve-workflow-guide.md`](./approve-workflow-guide.md)
10. [`database-relationship-overview.md`](./database-relationship-overview.md)
11. [`retrieval-pipeline-guide.md`](./retrieval-pipeline-guide.md)
12. [`retrieval-sidecar-provenance-guide.md`](./retrieval-sidecar-provenance-guide.md)
13. [`prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
14. [`retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
15. [`embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
16. [`engineering-overview.md`](./engineering-overview.md)

## 与根文档的关系

- 根文档 [`../README.md`](../README.md) 适合快速了解项目目标、核心能力和快速开始
- `docs` 目录更适合承载可持续维护的详细说明
