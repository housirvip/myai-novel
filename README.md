# myai-novel

`myai-novel` 是一个面向长篇小说创作流程的 AI CLI 工具。

它把“设定管理 + 章节工作流 + 事实回写”放进一套本地优先的命令行系统里，适合用来持续维护长篇、网文、系列小说的写作上下文。

当前 V1 基于 TypeScript、Node.js、SQLite、dotenv 构建，支持 `mock`、`openai`、`anthropic`、`custom` 四种 LLM provider。

## 快速入口

- [快速开始](#快速开始)
- [文档索引](docs/README.md)
- [命令行指南](docs/cli-usage-guide.md)

## 文档导航

- [文档索引](docs/README.md)
- [命令行使用指南](docs/cli-usage-guide.md)
- [Prompt 与工作流关系说明](docs/prompt-retrieval-relationship.md)
- [召回与打分规则说明](docs/retrieval-scoring-rules.md)

## 为什么做这个

长篇小说写作里，最容易失控的往往不是“写不出来”，而是：

- 设定分散，人物、势力、物品、钩子很难长期维护
- 写到中后期时，前文事实难以稳定召回
- AI 能写草稿，但不容易和结构化设定库形成闭环
- 手工修改章节后，正文和设定库容易脱节

`myai-novel` 的目标，就是把这些问题拆成明确的资源模型和工作流命令。

## 核心能力

- 资源管理：`book`、`outline`、`world`、`character`、`faction`、`relation`、`item`、`hook`、`chapter`
- 章节流水线：`plan -> draft -> review -> repair -> approve`
- 召回机制：基于作者意图、近期大纲、前文章节、手工指定实体 ID 做上下文召回
- 事实回写：`approve` 后把人物、势力、关系、物品、钩子、世界设定的变更回灌到设定库
- Markdown 编辑：支持导出 `plan / draft / final` 为 Markdown，再导入生成新版本
- 日志体系：记录数据表 CRUD、工作流耗时、LLM 调用耗时、成功与否，AI 输入输出可选记录

## V1 里最重要的设计

### 1. 章节正文是版本化的

这是对外说明里最需要讲清楚的一点。

- `plan` 存在 `chapter_plans`
- `draft` 存在 `chapter_drafts`
- `review` 存在 `chapter_reviews`
- `final` 存在 `chapter_finals`

`chapters` 主表只保存当前指针，例如：

- `current_plan_id`
- `current_draft_id`
- `current_review_id`
- `current_final_id`

这意味着：

- `approve` 不会覆盖某个单一的“final_content”字段
- 每次 `approve` 都会新增一条 `chapter_finals`
- 每次手工导入 `final` Markdown 也会新增一条 `chapter_finals`
- 当前生效正式稿由 `chapters.current_final_id` 指向

也就是说，正式稿和 plan/draft/review 一样，都是可追溯、可回滚、可保留来源的版本化数据。

### 2. 设定库和章节稿是双向联动的

- `plan` 会召回设定，给 AI 提供稳定上下文
- `approve` 会把最终正文里的新增事实回写进设定库

这让系统不是“只会写一章”，而是能随着章节推进不断积累小说世界状态。

### 3. 人工修改是工作流的一部分

你可以把 `plan`、`draft`、`final` 导出成 Markdown，手工修改后再导入。

导入不会覆盖旧版本，而是生成新版本并更新当前指针，适合：

- 人工修稿
- 编辑协作
- AI 初稿后的人类精修

## 环境要求

- Node.js `>= 20`
- npm `>= 10`

## 安装

```bash
npm install
cp .env.example .env
```

## 配置

完整示例见 [`.env.example`](./.env.example)。

最常用的最小配置如下：

```dotenv
DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=mock
MOCK_LLM_MODE=echo

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_LLM_CONTENT_ENABLED=false
```

配置说明：

- `DB_CLIENT` 当前支持 `sqlite`，并为未来 `mysql` 预留了接口
- `LLM_PROVIDER=mock` 适合本地联调、测试、演示
- `LOG_LLM_CONTENT_ENABLED=true` 时会把 AI 输入输出内容写入日志，默认关闭
- 使用 `openai`、`anthropic`、`custom` 时，分别补齐对应 API 配置

## 快速开始

初始化数据库：

```bash
npm run dev -- db init
npm run dev -- db check
```

使用最小示例数据：

```bash
bash ./examples/minimal-seed.sh
```

然后执行一遍章节工作流：

```bash
npm run dev -- plan --book 1 --chapter 1 --provider mock --authorIntent "让林夜带着黑铁令入宗，并引出宗门旧案线索。"
npm run dev -- draft --book 1 --chapter 1 --provider mock
npm run dev -- review --book 1 --chapter 1 --provider mock
npm run dev -- repair --book 1 --chapter 1 --provider mock
npm run dev -- approve --book 1 --chapter 1 --provider mock
```

## 命令行文档

更完整的命令行使用方式、参数说明和示例，请查阅：

- [`docs/README.md`](docs/README.md)
- [`docs/cli-usage-guide.md`](docs/cli-usage-guide.md)
- [`docs/prompt-retrieval-relationship.md`](docs/prompt-retrieval-relationship.md)
- [`docs/retrieval-scoring-rules.md`](docs/retrieval-scoring-rules.md)
- [`docs/engineering-overview.md`](docs/engineering-overview.md)

## 当前状态

V1 已完成核心目标：

- 核心表结构与迁移
- 资源 CRUD CLI
- 章节工作流全链路
- 正式稿版本化
- 结构化事实回写
- Markdown 导入导出
- 测试基线

下一阶段比较自然的方向通常是：

- 向量召回 / RAG
- 更强的关系演化建模
- 冲突检测与设定一致性审计
- 批量章节工作流
- Web UI / 可视化管理端
