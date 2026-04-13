# 文档索引

## 目录

- [文档列表](#文档列表)
- [推荐阅读顺序](#推荐阅读顺序)
- [与根文档的关系](#与根文档的关系)

这里集中整理 `myai-novel` 当前的核心说明文档，方便从一个入口快速找到需要的内容。

## 文档列表

- [`cli-usage-guide.md`](./cli-usage-guide.md)
  - 命令行使用指南
  - 适合查安装、配置、数据库初始化、资源管理、章节工作流、Markdown 导入导出

- [`env-config-guide.md`](./env-config-guide.md)
  - 环境变量配置指南
  - 适合查 `.env` 字段用途、provider 配置、日志配置、数据库配置与召回限制配置

- [`prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
  - Prompt 与工作流关系说明
  - 适合查 `plan / draft / review / repair / approve` 的阶段链路、Prompt 结构和共享上下文角色

- [`retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
  - 召回与打分规则说明
  - 适合查 `plan` 阶段的召回策略、打分细则、排序规则、实体匹配字段与相关配置项

- [`embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
  - embedding 与 rerank 实现说明
  - 适合查 embedding 文档构造、refresh/store/search 流程、candidate merge、heuristic rerank 与实验链路职责边界

- [`engineering-overview.md`](./engineering-overview.md)
  - 日志、测试与项目结构
  - 适合查工程维护相关信息、测试命令、日志配置与项目概览

## 推荐阅读顺序

如果你是第一次接触这个项目，建议按下面顺序阅读：

1. [`cli-usage-guide.md`](./cli-usage-guide.md)
2. [`env-config-guide.md`](./env-config-guide.md)
3. [`prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
4. [`retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
5. [`embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
6. [`engineering-overview.md`](./engineering-overview.md)

## 与根文档的关系

- 根文档 [`../README.md`](../README.md) 适合快速了解项目目标、核心能力和快速开始
- `docs` 目录更适合承载可持续维护的详细说明
