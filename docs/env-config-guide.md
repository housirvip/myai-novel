# 环境变量配置指南

## 目录

- [1. 文档目标](#1-文档目标)
- [2. 快速开始](#2-快速开始)
- [3. Runtime 配置](#3-runtime-配置)
- [4. 日志配置](#4-日志配置)
- [5. 数据库配置](#5-数据库配置)
- [6. LLM provider 配置](#6-llm-provider-配置)
- [7. Planning 与召回配置](#7-planning-与召回配置)
- [8. 推荐配置示例](#8-推荐配置示例)
- [9. 常见建议](#9-常见建议)
- [相关阅读](#相关阅读)

## 1. 文档目标

本文整理 `myai-novel` 当前 `.env` 中各环境变量的用途、推荐用法和最小配置方式，适合作为配置查阅入口。

完整模板请参考：[`../.env.example`](../.env.example)

## 2. 快速开始

首次配置建议：

```bash
cp .env.example .env
```

本地最小可运行配置：

```dotenv
NODE_ENV=development

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_DIR=./logs
LOG_LLM_CONTENT_ENABLED=false
LOG_LLM_CONTENT_MAX_CHARS=4000

DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=mock
MOCK_LLM_MODE=echo
MOCK_LLM_MODEL=mock-v1
LLM_DEFAULT_MAX_TOKENS=2048
```

配置完成后建议执行：

```bash
npm run dev -- db init
npm run dev -- db check
```

## 3. Runtime 配置

### `NODE_ENV`

运行环境。

示例：

```dotenv
NODE_ENV=development
```

常见值：

- `development`
- `production`
- `test`

一般本地开发使用 `development`。

## 4. 日志配置

### `LOG_LEVEL`

日志级别。

```dotenv
LOG_LEVEL=info
```

常见用途：

- 本地开发：`info`
- 排查问题：可临时调高日志详细程度

### `LOG_FORMAT`

日志输出格式。

```dotenv
LOG_FORMAT=pretty
```

常见用途：

- 本地阅读终端输出时，`pretty` 更友好
- 机器处理日志时，可考虑使用结构化格式

### `LOG_DIR`

日志输出目录。

```dotenv
LOG_DIR=./logs
```

### `LOG_LLM_CONTENT_ENABLED`

是否记录 AI 输入输出正文。

```dotenv
LOG_LLM_CONTENT_ENABLED=false
```

建议：

- 默认关闭
- 只有在排查 prompt 或输出异常时再临时开启

### `LOG_LLM_CONTENT_MAX_CHARS`

AI 输入输出内容的最大日志截断长度。

```dotenv
LOG_LLM_CONTENT_MAX_CHARS=4000
```

## 5. 数据库配置

### `DB_CLIENT`

数据库类型。

```dotenv
DB_CLIENT=sqlite
```

当前模板说明支持：

- `sqlite`
- `mysql`

但从当前项目文档和用法看，主要使用的是 `sqlite`。

### `DB_SQLITE_PATH`

SQLite 数据库文件路径。

```dotenv
DB_SQLITE_PATH=./data/novel.db
```

本地开发建议保持默认相对路径，便于直接运行。

## 6. LLM provider 配置

### `LLM_PROVIDER`

默认 provider。

```dotenv
LLM_PROVIDER=mock
```

可选值：

- `mock`
- `openai`
- `anthropic`
- `custom`

### 6.1 Mock provider

#### `MOCK_LLM_MODE`

```dotenv
MOCK_LLM_MODE=echo
```

可选值：

- `echo`
- `fixture`
- `json`

#### `MOCK_LLM_RESPONSE_TEXT`

```dotenv
MOCK_LLM_RESPONSE_TEXT=Mock response
```

用于 mock 输出固定文本。

#### `MOCK_LLM_FIXTURE_PATH`

```dotenv
MOCK_LLM_FIXTURE_PATH=
```

当 `MOCK_LLM_MODE=fixture` 时，用于指定 fixture 文件路径。

#### `MOCK_LLM_MODEL`

```dotenv
MOCK_LLM_MODEL=mock-v1
```

### `LLM_DEFAULT_MAX_TOKENS`

默认最大输出 token 数。

```dotenv
LLM_DEFAULT_MAX_TOKENS=2048
```

### 6.2 OpenAI provider

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-5.4-mini
```

说明：

- `OPENAI_API_KEY`：OpenAI API key
- `OPENAI_BASE_URL`：兼容代理或自定义网关时可配置
- `OPENAI_MODEL`：默认模型名

### 6.3 Anthropic provider

```dotenv
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

说明：

- `ANTHROPIC_API_KEY`：Anthropic API key
- `ANTHROPIC_BASE_URL`：兼容代理或自定义网关时可配置
- `ANTHROPIC_MODEL`：默认模型名

### 6.4 Custom provider

```dotenv
CUSTOM_LLM_BASE_URL=
CUSTOM_LLM_API_KEY=
CUSTOM_LLM_MODEL=custom-default
```

适合接入自定义兼容服务。

## 7. Planning 与召回配置

这部分配置主要影响：

- 作者意图关键词提取
- `plan` 阶段的召回数量与扫描范围
- 各类实体最终进入 `retrievedContext` 的上限

### 7.1 关键词提取限制

```dotenv
PLANNING_KEYWORD_MAX_LENGTH=8
PLANNING_INTENT_KEYWORD_LIMIT=20
PLANNING_INTENT_MUST_INCLUDE_LIMIT=20
PLANNING_INTENT_MUST_AVOID_LIMIT=20
```

含义：

- `PLANNING_KEYWORD_MAX_LENGTH`：单个关键词最大长度
- `PLANNING_INTENT_KEYWORD_LIMIT`：关键词数量上限
- `PLANNING_INTENT_MUST_INCLUDE_LIMIT`：`mustInclude` 上限
- `PLANNING_INTENT_MUST_AVOID_LIMIT`：`mustAvoid` 上限

### 7.2 召回上限配置

```dotenv
PLANNING_RETRIEVAL_OUTLINE_LIMIT=3
PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT=3
PLANNING_RETRIEVAL_HOOK_LIMIT=10
PLANNING_RETRIEVAL_CHARACTER_LIMIT=12
PLANNING_RETRIEVAL_FACTION_LIMIT=8
PLANNING_RETRIEVAL_ITEM_LIMIT=8
PLANNING_RETRIEVAL_RELATION_LIMIT=10
PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT=8
```

含义：

- 控制不同类型内容最终返回多少条
- 值越大，进入 prompt 的上下文越多
- 值过大时，可能让 prompt 变长、噪声增加

### 7.3 扫描范围配置

```dotenv
PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER=5
PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT=200
```

含义：

- `PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`：最近章节召回的候选扫描倍率
- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`：实体类候选扫描上限

可以理解为：

- 先扫描一批候选
- 再按规则打分、排序、截断

更详细的召回规则请看：[`docs/retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)

## 8. 推荐配置示例

### 8.1 本地联调

```dotenv
NODE_ENV=development

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_DIR=./logs
LOG_LLM_CONTENT_ENABLED=false
LOG_LLM_CONTENT_MAX_CHARS=4000

DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=mock
MOCK_LLM_MODE=echo
MOCK_LLM_MODEL=mock-v1
LLM_DEFAULT_MAX_TOKENS=2048
```

适合：

- 跑通 CLI
- 验证数据库与工作流
- 不依赖真实模型接口

### 8.2 接入 OpenAI

```dotenv
DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.4-mini

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_LLM_CONTENT_ENABLED=false
```

### 8.3 接入 Anthropic

```dotenv
DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_LLM_CONTENT_ENABLED=false
```

## 9. 常见建议

- 本地第一次跑通流程，优先使用 `mock`
- 默认不要开启 `LOG_LLM_CONTENT_ENABLED=true`
- 调整召回相关上限时，优先小步修改，不要一次把所有 limit 拉得很高
- 如果只是测试 CLI 与数据流，保持默认 `sqlite` 配置即可
- 如果需要临时覆盖模型或 provider，也可以优先用 CLI 参数 `--provider`、`--model`，不一定非要改 `.env`

## 相关阅读

- [`README.md`](../README.md)
- [`docs/README.md`](./README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
- [`docs/retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
- [`../.env.example`](../.env.example)
