# myai-novel

`myai-novel` 是一个面向长篇小说创作流程的 AI CLI 工具。

它把“设定管理 + 章节工作流 + 事实回写”放进一套本地优先的命令行系统里，适合用来持续维护长篇、网文、系列小说的写作上下文。

当前基于 TypeScript、Node.js、SQLite / MySQL、dotenv 构建，支持 `mock`、`openai`、`anthropic`、`custom` 四种 LLM provider。

## 快速入口

- [快速开始](#快速开始)
- [文档索引](docs/README.md)
- [命令行指南](docs/cli-usage-guide.md)
- [环境变量配置](docs/env-config-guide.md)

## 文档导航

- [文档索引](docs/README.md)
- [命令行使用指南](docs/cli-usage-guide.md)
- [环境变量配置指南](docs/env-config-guide.md)
- [章节全流水线总览](docs/chapter-pipeline-overview.md)
- [Plan 工作流详解](docs/plan-workflow-guide.md)
- [Approve 工作流详解](docs/approve-workflow-guide.md)
- [Retrieval 全链路详解](docs/retrieval-pipeline-guide.md)
- [Retrieval sidecar 与 provenance 说明](docs/retrieval-sidecar-provenance-guide.md)

如果你想系统阅读完整文档树，直接从 [`docs/README.md`](docs/README.md) 进入会更合适。

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
- 召回机制：基于作者意图、近期大纲、前文章节、手工指定实体 ID 做规则式上下文召回
- 阶段化上下文：`retrievedContext` 已拆分为 `hardConstraints`、`softReferences`、`riskReminders`、`priorityContext`、`recentChanges`
- 事实回写：`approve` 后把人物、势力、关系、物品、钩子、世界设定的变更回灌到设定库
- retrieval sidecar：`approve` 后还会写入 `retrieval_documents`、`retrieval_facts`、`story_events`、`chapter_segments`，作为后续检索与 `plan` 的补充输入
- provenance 与可观测性：`riskReminders / recentChanges / priorityContext` 已支持 `sourceRef / sourceRefs / surfacedIn`，便于追踪 sidecar 信号如何进入上下文视图
- Markdown 编辑：支持导出 `plan / draft / final` 为 Markdown，再导入生成新版本
- 数据库支持：默认 SQLite，本地开发体验不变；同时支持 `DB_CLIENT=mysql`
- 实验扩展：已支持 `HeuristicReranker`、embedding candidate provider、basic / hybrid embedding search mode；当前在线 embedding 候选链路接线实体为 `character / faction / item / hook / relation / world_setting`
- embedding provider：已支持本地 hash provider 与自定义远程 embedding provider（OpenAI-compatible `/embeddings`）
- retrieval 结构收敛：当前已拆分为 candidate provider、service factory、reranker factory、context builder、hard constraints、risk reminders 等模块
- 日志体系：记录数据表 CRUD、工作流耗时、LLM 调用耗时、成功与否，AI 输入输出可选记录

## 当前实现重点

### 1. `retrievedContext` 不再是扁平召回结果

当前章节规划阶段保存的上下文已经拆成五层：

- `hardConstraints`：容易写错且会直接破坏连续性的硬约束
- `softReferences`：可供不同阶段继续裁剪的完整召回结果
- `riskReminders`：提示模型优先关注连续性高风险点
- `priorityContext`：把事实按 prompt 优先级继续分层
- `recentChanges`：把近期变化压成更适合 prompt 消费的视图

这意味着：

- `draft` 会优先消费强约束上下文
- `review` 和 `approve` 会按阶段消费更聚焦的上下文视图，减少噪声
- `plan` 固化下来的上下文仍然是全流程共享基线
- sidecar 信号也会继续进入这些层，而不是只停留在底层检索结果里

### 2. MySQL 已成为正式支持目标

当前实现不是只在配置里预留 `mysql`，而是已经支持：

- `DB_CLIENT=mysql` 启动
- `db init` / `db check`
- `plan -> draft -> review -> repair -> approve`
- `chapter export/import`

默认本地开发仍建议使用：

- `DB_CLIENT=sqlite`
- `LLM_PROVIDER=mock`

### 3. 召回扩展实验已接入，但默认行为仍稳定

当前默认仍是：

- 规则式候选召回
- 直接按现有业务规则排序与截断

同时当前也已经接入实验层：

- `RetrievalCandidateProvider`
- `RetrievalReranker`
- `HeuristicReranker`
- `EmbeddingCandidateProvider`
- `basic / hybrid` embedding search mode

当前相关职责已经进一步拆分为：

- `retrieval-candidate-provider-rule.ts`
- `retrieval-service-factory.ts`
- `retrieval-reranker-factory.ts`
- `retrieval-context-builder.ts`

也就是说：

- 默认主链路仍稳定可用
- embedding / rerank 实验不需要重写 workflow，正常 workflow 也可通过配置直接接入实验链路
- 已建立固定样本 benchmark，用于比较和回归验证实验链路效果

## 当前最重要的设计

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
- 每次 `repair` 也会新增一条新的 `chapter_drafts`
- 每次手工导入 `final` Markdown 也会新增一条 `chapter_finals`
- 当前生效正式稿由 `chapters.current_final_id` 指向

同时，`draft / review / repair / approve` 在模型生成完成后、正式提交前都会重新校验 `chapters.current_*_id` 指针；如果章节上下文已被其他操作切换，当前提交会直接失败，避免把新版本叠到过期上下文上。

也就是说，正式稿和 plan/draft/review 一样，都是可追溯、可回滚、可保留来源的版本化数据。

### 2. 设定库和章节稿是双向联动的

- `plan` 会召回设定，给 AI 提供稳定上下文
- `approve` 会把最终正文里的新增事实回写进设定库

现在这条链路又往前走了一步：

- `approve` 还会把章节摘要、事实更新、关键事件、章节片段沉淀成 retrieval sidecar
- 后续 `plan` / 检索阶段会继续消费这些 persisted facts / events

这意味着系统不仅会“回写设定”，还会把剧情推进本身变成可继续召回的长期记忆。

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

`.env.example` 是运行时模板，不应该承载真实 MySQL 测试凭据。

## 配置

完整环境变量模板见 [`.env.example`](./.env.example)。

更完整的字段说明、provider 配置、日志配置、数据库配置和召回限制配置，请查阅：

- [`docs/env-config-guide.md`](docs/env-config-guide.md)

如果你只是想本地快速跑通，优先使用：

- `DB_CLIENT=sqlite`
- `LLM_PROVIDER=mock`
- `MOCK_LLM_MODE=echo`
- `LOG_LEVEL=info`
- `LOG_FORMAT=pretty`
- `LOG_LLM_CONTENT_ENABLED=false`

如果你要切到 MySQL，至少需要：

- `DB_CLIENT=mysql`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_POOL_MAX`

完整字段说明见：

- [`docs/env-config-guide.md`](docs/env-config-guide.md)

MySQL 集成测试是可选的真实数据库验证，不依赖 `.env.example`。如果你要显式运行这类测试，请单独提供：

- `MYSQL_TEST_HOST`
- `MYSQL_TEST_PORT`
- `MYSQL_TEST_USER`
- `MYSQL_TEST_PASSWORD`
- `MYSQL_TEST_DATABASE`

然后执行：

```bash
npm run test:mysql
```

也可以先参考模板：

- [`.env.mysql.test.example`](./.env.mysql.test.example)

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

## 测试与验证

常用检查命令：

```bash
npm run check
npm run build
npm test
```

如果你需要可选的真实 MySQL 集成验证，还可以执行：

```bash
npm run test:mysql
```

更完整的命令行与专题文档，请从 [`docs/README.md`](docs/README.md) 进入。

## 当前状态

当前已完成的主线能力：

- 核心表结构与迁移
- 资源 CRUD CLI
- 章节工作流全链路
- 分层召回与阶段化上下文视图
- `priorityContext` / `recentChanges`
- 可读 prompt 事实块
- 正式稿版本化
- 结构化事实回写
- retrieval sidecar：`retrieval_documents / retrieval_facts / story_events / chapter_segments`
- `approve -> sidecar -> next plan` 闭环
- provenance 与 sidecar observability：`sourceRef / sourceRefs / surfacedIn`
- Markdown 导入导出
- SQLite 与 MySQL 主链验证
- `HeuristicReranker` 与 embedding 实验链路（当前在线接线实体为 `character / faction / item / hook / relation / world_setting`）
- retrieval benchmark 基线，持续用于规则链路与实验链路的回归比较
- retrieval 模块第二轮结构收敛（provider / factory / context builder 已拆出）
- 自动化测试与集成验证基线

下一阶段比较自然的方向通常是：

- embedding 候选召回 / rerank 实验
- 更强的关系演化建模
- 冲突检测与设定一致性审计
- 批量章节工作流
- Web UI / 可视化管理端
