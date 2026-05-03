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

当前默认仍然是 `sqlite`，但 V2 已补齐 MySQL 的基础配置入口、dialect 创建和 client 路由。

### `DB_SQLITE_PATH`

SQLite 数据库文件路径。

```dotenv
DB_SQLITE_PATH=./data/novel.db
```

本地开发建议保持默认相对路径，便于直接运行。

### MySQL 连接配置

当 `DB_CLIENT=mysql` 时，使用以下配置：

```dotenv
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=myai_novel
DB_USER=root
DB_PASSWORD=
DB_POOL_MAX=10
```

含义：

- `DB_HOST`：MySQL 主机地址
- `DB_PORT`：MySQL 端口
- `DB_NAME`：数据库名
- `DB_USER`：用户名
- `DB_PASSWORD`：密码
- `DB_POOL_MAX`：连接池最大连接数

说明：

- 本地开发默认仍建议先用 `sqlite`
- MySQL 主要用于部署或验证跨方言兼容性
- 当前已支持 `db check` 和 client 创建；完整 migration / workflow 端到端验证仍建议结合真实 MySQL 实例执行

### MySQL 集成测试专用变量

默认 `npm test` 不要求你本地一定存在 MySQL。只有在你显式提供下面这些变量时，MySQL 集成测试才会真正执行：

```dotenv
MYSQL_TEST_HOST=127.0.0.1
MYSQL_TEST_PORT=3306
MYSQL_TEST_USER=root
MYSQL_TEST_PASSWORD=
MYSQL_TEST_DATABASE=myai_novel
```

说明：

- 这组变量只用于测试辅助逻辑创建临时测试库
- 不建议把它们写进公开共享的 `.env.example`
- 运行 MySQL 集成测试时使用：`npm run test:mysql`
- 可参考模板：[`../.env.mysql.test.example`](../.env.mysql.test.example)

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

### 统一模型档位路由

当前工作流支持一层统一的 low / mid / high 模型档位路由，用来把不同复杂度的任务映射到不同模型。

优先级如下：

1. 命令行或 workflow 显式传入的 `--model`
2. 档位对应的环境变量
3. provider 自己的默认模型（如 `OPENAI_MODEL`、`ANTHROPIC_MODEL`、`CUSTOM_LLM_MODEL`、`MOCK_LLM_MODEL`）

也就是说：

- 你如果显式传了 `--model`，会覆盖所有档位配置
- 你如果没有显式传 `--model`，workflow 会先尝试 low / mid / high 对应的档位模型
- 档位模型未设置时，才回退到 provider 默认模型

推荐配置：

```dotenv
LLM_LOW_MODEL=
LLM_MID_MODEL=
LLM_HIGH_MODEL=
```

兼容旧字段：

```dotenv
LLM_LIGHT_MODEL=
LLM_MEDIUM_MODEL=
```

说明：

- 新字段 `LLM_LOW_MODEL` / `LLM_MID_MODEL` / `LLM_HIGH_MODEL` 是当前推荐命名
- 旧字段 `LLM_LIGHT_MODEL` / `LLM_MEDIUM_MODEL` 仍保留兼容
- 如果新旧字段同时存在，优先读取新字段

当前工作流的大致档位分配是：

- `low`：关键词提取、review 结构化审校、approve diff 抽取
- `mid`：作者意图生成、章节 plan 生成
- `high`：draft 正文、repair 修稿、approve 最终定稿

### 6.2 OpenAI provider

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-5.4-mini
```

说明：

- `OPENAI_API_KEY`：OpenAI API key；当 `LLM_PROVIDER=openai` 时必填
- `OPENAI_BASE_URL`：兼容代理或自定义网关时可配置
- `OPENAI_MODEL`：默认模型名

### 6.3 Anthropic provider

```dotenv
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

说明：

- `ANTHROPIC_API_KEY`：Anthropic API key；当 `LLM_PROVIDER=anthropic` 时必填
- `ANTHROPIC_BASE_URL`：兼容代理或自定义网关时可配置
- `ANTHROPIC_MODEL`：默认模型名

### 6.4 Custom provider

```dotenv
CUSTOM_LLM_BASE_URL=
CUSTOM_LLM_API_KEY=
CUSTOM_LLM_MODEL=custom-default
```

适合接入自定义兼容服务。

- `CUSTOM_LLM_BASE_URL`：当 `LLM_PROVIDER=custom` 时必填
- `CUSTOM_LLM_API_KEY`：可选；如果你的兼容服务要求 Bearer 鉴权，再填写该字段
- `CUSTOM_LLM_MODEL`：默认模型名

## 7. Planning 与召回配置

这部分配置主要影响：

- 作者意图关键词提取
- `plan` 阶段的召回数量与扫描范围
- persisted facts / events 的保留与长尾召回
- `recentChanges` 的聚合范围
- reranker 与 embedding 检索行为
- 各类实体最终进入 `retrievedContext` 与 prompt context 的上限

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
PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT=8
PLANNING_RETRIEVAL_HOOK_LIMIT=24
PLANNING_RETRIEVAL_CHARACTER_LIMIT=32
PLANNING_RETRIEVAL_FACTION_LIMIT=20
PLANNING_RETRIEVAL_ITEM_LIMIT=20
PLANNING_RETRIEVAL_RELATION_LIMIT=32
PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT=20
```

含义：

- 默认值已按长篇小说 planning 做过上调，更适合人物、关系、钩子较多的书
- 控制不同类型内容最终返回多少条
- 值越大，进入 prompt 的上下文越多
- 值过大时，可能让 prompt 变长、噪声增加

### 7.3 扫描范围配置

```dotenv
PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER=12
PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT=1500
```

含义：

- `PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`：最近章节召回的候选扫描倍率
- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`：实体类候选扫描上限
- 当前默认值更偏向长篇场景：先更广地扫描，再由规则排序和后续 prompt 预算压缩结果

可以理解为：

- 先扫描一批候选
- 再按规则打分、排序、截断

### 7.4 persisted sidecar 召回配置

```dotenv
PLANNING_RETRIEVAL_PERSISTED_FACT_LIMIT=14
PLANNING_RETRIEVAL_PERSISTED_EVENT_LIMIT=8
PLANNING_RETRIEVAL_PERSISTED_PRIORITY_FACT_LIMIT=7
PLANNING_RETRIEVAL_PERSISTED_PRIORITY_EVENT_LIMIT=5
PLANNING_RETRIEVAL_PERSISTED_RISK_FACT_LIMIT=5
PLANNING_RETRIEVAL_PERSISTED_RISK_EVENT_LIMIT=4
PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_RESERVE=1
PLANNING_RETRIEVAL_PERSISTED_EVENT_LONG_TAIL_RESERVE=1
PLANNING_RETRIEVAL_PERSISTED_LONG_TAIL_MIN_CHAPTER_GAP=8
PLANNING_RETRIEVAL_PERSISTED_FACT_LONG_TAIL_MIN_RISK=80
```

说明：

- 这组配置控制 `approve` 沉淀下来的 `persisted facts / story events` 在后续 `plan` 里如何被再次检索
- `..._LIMIT` 控制事实与事件的基础选入上限
- `..._PRIORITY_*` 控制进入 `priorityContext` 的重点事实/事件上限
- `..._RISK_*` 控制更偏连续性风险的事实/事件上限
- `..._LONG_TAIL_*` 用于保留少量“章节距离较远但仍高风险/高价值”的历史信息，避免长篇里重要旧事实被完全淹没

### 7.5 `recentChanges` 聚合配置

```dotenv
PLANNING_RECENT_CHANGES_CHAPTER_LIMIT=8
PLANNING_RECENT_CHANGES_RISK_LIMIT=6
PLANNING_RECENT_CHANGES_ENTITY_LIMIT=5
PLANNING_RECENT_CHANGES_FACT_LIMIT=8
PLANNING_RECENT_CHANGES_EVENT_LIMIT=5
PLANNING_RECENT_CHANGES_TOTAL_LIMIT=15
```

说明：

- 这组配置控制 `recentChanges` 视图里最多保留多少条近期章节承接、风险提醒、实体状态、persisted facts 与 story events
- `..._TOTAL_LIMIT` 是最终总上限，其余配置控制不同来源在进入总池前的分项保留数量
- 如果你发现 planning prompt 过于偏向近期变化或噪声过多，可以优先调这组值

### 7.6 reranker 配置

```dotenv
PLANNING_RETRIEVAL_RERANKER=heuristic
```

说明：

- 当前支持 `none | heuristic`
- 当前默认值是 `heuristic`，不是 `none`
- `heuristic` 会在规则候选与 embedding 补候选之后，再按业务启发式规则做一次重排，更适合长篇场景下的连续性优先排序

### 7.7 Embedding 检索配置

```dotenv
PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=none
PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE=basic
PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE=0.64
PLANNING_RETRIEVAL_EMBEDDING_ONLY_MIN_SCORE=0.72
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC=32
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_HYBRID=40
```

说明：

- `PLANNING_RETRIEVAL_EMBEDDING_PROVIDER`：embedding 检索模式，支持 `none | hash | custom`
  - `none`：关闭 embedding 增强，仅使用规则召回
  - `hash`：启用本地 deterministic hash embedding
  - `custom`：启用远程 OpenAI-compatible `/embeddings` 服务
- `PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE`：embedding searcher 模式，支持 `basic | hybrid`
- `PLANNING_RETRIEVAL_EMBEDDING_MIN_SCORE`：已有规则候选要获得 `embedding_support` 的最低语义分
- `PLANNING_RETRIEVAL_EMBEDDING_ONLY_MIN_SCORE`：纯 embedding 候选允许补入主链的最低语义分
- `PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC / HYBRID`：两种 embedding 模式下的最大返回条数
- 当前默认 top-K 也已调高，更适合长篇中同主题实体较多的情况
- 当 `PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom` 时，还需要配置：
  - `CUSTOM_EMBEDDING_BASE_URL`
  - `CUSTOM_EMBEDDING_API_KEY`
  - `CUSTOM_EMBEDDING_MODEL`（可使用默认值）
  - `CUSTOM_EMBEDDING_PATH`（默认 `/embeddings`）
  - `CUSTOM_EMBEDDING_BATCH_SIZE`（默认 `10`，控制单次远程 embedding 请求的批量大小）

更详细的召回规则请看：[`docs/retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)

### 7.7.1 长篇模式说明

当前 `.env.example` 中给出的 planning / retrieval 默认值，已经偏向**长篇小说 planning 场景**，目的是降低 1000+ 章项目中过早漏召回的问题。

但要注意：

1. 这只是**容量扩容**，不是结构升级。
2. 它能缓解 scan cap 和 top-K 太小的问题。
3. 它不能根治当前“一实体一语义文档”的粒度问题。
4. 如果要真正支撑百万字长篇，后续仍然需要 fact / event / chapter-segment 检索升级。

### 7.8 Prompt 上下文预算配置

```dotenv
PLANNING_PROMPT_CONTEXT_PLAN_CHAR_BUDGET=5200
PLANNING_PROMPT_CONTEXT_DRAFT_CHAR_BUDGET=5200
PLANNING_PROMPT_CONTEXT_REVIEW_CHAR_BUDGET=3800
PLANNING_PROMPT_CONTEXT_REPAIR_CHAR_BUDGET=4800
PLANNING_PROMPT_CONTEXT_APPROVE_CHAR_BUDGET=4000
PLANNING_PROMPT_CONTEXT_APPROVE_DIFF_CHAR_BUDGET=3000
```

说明：

- 这些值控制不同阶段可注入 prompt 的上下文总字符预算
- 当前系统会优先保留 `mustFollowFacts / recentChanges / coreEntities`，再分配剩余预算给背景信息
- 如果你在长篇中发现 prompt 过长或背景噪声偏多，优先调这些预算，而不是盲目增加召回上限

### 7.9 Prompt 上下文分块上限

```dotenv
PLANNING_PROMPT_CONTEXT_MUST_FOLLOW_LIMIT=8
PLANNING_PROMPT_CONTEXT_RECENT_CHANGES_LIMIT=6
PLANNING_PROMPT_CONTEXT_CORE_ENTITIES_LIMIT=8
PLANNING_PROMPT_CONTEXT_REQUIRED_HOOKS_LIMIT=6
PLANNING_PROMPT_CONTEXT_FORBIDDEN_MOVES_LIMIT=5
PLANNING_PROMPT_CONTEXT_SUPPORTING_BACKGROUND_LIMIT=6
```

说明：

- 这组配置不是控制总字符预算，而是控制不同 prompt context block 最多保留多少条事实
- `MUST_FOLLOW` 更偏硬约束，`RECENT_CHANGES` 更偏章节承接，`CORE_ENTITIES` 更偏主要人物/势力/物品，`REQUIRED_HOOKS` 与 `FORBIDDEN_MOVES` 分别对应必须推进与必须规避的内容
- 当你想减少某一类上下文在 prompt 里的“刷屏”现象时，优先调这里；当你想整体缩短 prompt，再去调上一节的 char budget

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

## 阅读导航

- 上一篇：[`docs/cli-usage-guide.md`](./cli-usage-guide.md)
- 下一篇：[`docs/chapter-pipeline-overview.md`](./chapter-pipeline-overview.md)
