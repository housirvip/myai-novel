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
plan/                 V1 方案与 checklist
examples/             示例脚本
```

## 4. 当前状态

V1 已完成核心目标：

- 核心表结构与迁移
- 资源 CRUD CLI
- 章节工作流全链路
- 正式稿版本化
- 结构化事实回写
- Markdown 导入导出
- 测试基线

如果你想继续往下扩展，下一阶段比较自然的方向通常是：

- 向量召回 / RAG
- 更强的关系演化建模
- 冲突检测与设定一致性审计
- 批量章节工作流
- Web UI / 可视化管理端

## 相关阅读

- [`README.md`](../README.md)
- [`docs/README.md`](./README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
