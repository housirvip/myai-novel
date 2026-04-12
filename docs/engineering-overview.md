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

其中与 V2 最相关的目录包括：

- `src/domain/planning/`
  - `prompts.ts`：各阶段 prompt 构建
  - `context-views.ts`：阶段化上下文视图
  - `retrieval-ranking.ts`：规则打分与 explainability
  - `retrieval-pipeline.ts`：候选提供与 rerank 预留接口
  - `retrieval-service.ts`：当前默认规则召回主链
- `src/core/db/`
  - `dialects/sqlite.ts`
  - `dialects/mysql.ts`
  - `migrations/initial.ts`
- `test/integration/`
  - SQLite 章节工作流与 Markdown 测试
  - MySQL 真实端到端 workflow 测试

## 4. 当前状态

V2 当前状态：

- 核心表结构与迁移
- 资源 CRUD CLI
- 章节工作流全链路
- 分层召回与阶段化上下文视图
- 正式稿版本化
- 结构化事实回写
- Markdown 导入导出
- SQLite / MySQL 双方言主链验证
- rerank / embedding 接口预留
- 自动化测试基线

如果你想继续往下扩展，下一阶段比较自然的方向通常是：

- embedding 候选召回 / RAG
- 业务层 rerank 实验
- 更强的关系演化建模
- 冲突检测与设定一致性审计
- 批量章节工作流
- Web UI / 可视化管理端

## 相关阅读

- [`README.md`](../README.md)
- [`docs/README.md`](./README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
