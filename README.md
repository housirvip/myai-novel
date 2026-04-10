# myai-novel

`myai-novel` 是一个面向长篇小说创作流程的 AI CLI 工具。

它把“设定管理 + 章节工作流 + 事实回写”放进一套本地优先的命令行系统里，适合用来持续维护长篇、网文、系列小说的写作上下文。

当前 V1 基于 TypeScript、Node.js、SQLite、dotenv 构建，支持 `mock`、`openai`、`anthropic`、`custom` 四种 LLM provider。

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

完整示例见 [`.env.example`](/Users/housirvip/codex/myai-novel/.env.example)。

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

## 初始化数据库

```bash
npm run dev -- db init
npm run dev -- db check
```

如需显式执行迁移：

```bash
npm run dev -- db migrate
```

## 5 分钟快速开始

### 方案 A：直接写入一套最小示例数据

仓库自带脚本：[examples/minimal-seed.sh](/Users/housirvip/codex/myai-novel/examples/minimal-seed.sh)

```bash
bash ./examples/minimal-seed.sh
```

它会自动完成：

- 初始化数据库
- 创建一本书
- 创建一章
- 创建最小可用的大纲、世界设定、人物、势力、关系、物品、钩子

跑完后可以直接继续：

```bash
npm run dev -- plan --book 1 --chapter 1 --provider mock --authorIntent "让林夜带着黑铁令入宗，并引出宗门旧案线索。"
npm run dev -- draft --book 1 --chapter 1 --provider mock
npm run dev -- review --book 1 --chapter 1 --provider mock
npm run dev -- repair --book 1 --chapter 1 --provider mock
npm run dev -- approve --book 1 --chapter 1 --provider mock
```

### 方案 B：手动建一套最小资源

```bash
npm run dev -- book create --title "青岳入门录" --targetChapters 200
npm run dev -- chapter create --book 1 --chapter 1 --title "黑铁令"
npm run dev -- outline create --book 1 --title "入宗篇" --chapterStart 1 --chapterEnd 10 --storyCore "主角带着异常令牌进入宗门"
npm run dev -- world create --book 1 --title "宗门制度" --category "势力规则" --content "外门弟子通过令牌登记入门" --keywords "宗门,外门,令牌"
npm run dev -- character create --book 1 --name "林夜" --background "出身寒门" --keywords "林夜,主角"
npm run dev -- faction create --book 1 --name "青岳宗" --keywords "青岳宗,外门"
npm run dev -- relation create --book 1 --sourceType character --sourceId 1 --targetType faction --targetId 1 --relationType member --keywords "林夜,外门"
npm run dev -- item create --book 1 --name "黑铁令" --ownerType none --keywords "黑铁令,令牌"
npm run dev -- hook create --book 1 --title "黑铁令异常" --hookType mystery --keywords "黑铁令,异常"
```

## 工作流说明

### `plan`

作用：

- 读取作者意图
- 如果没提供作者意图，则基于近期大纲和前文章节自动生成意图草案
- 用 AI 提取关键词
- 根据关键词和手工指定实体 ID 召回强相关上下文
- 生成结构化章节规划，并写入 `chapter_plans`

示例：

```bash
npm run dev -- plan \
  --book 1 \
  --chapter 12 \
  --provider mock \
  --authorIntent "本章要让主角借黑铁令撬开外门局势" \
  --characterIds 1,2 \
  --factionIds 1 \
  --relationIds 3 \
  --itemIds 1 \
  --hookIds 1,4 \
  --worldSettingIds 2,5 \
  --json
```

### `draft`

作用：

- 基于当前 plan 和召回上下文生成草稿
- 写入 `chapter_drafts`

```bash
npm run dev -- draft --book 1 --chapter 12 --provider mock
```

### `review`

作用：

- 检查草稿的设定一致性、人物行为、节奏、逻辑漏洞和钩子推进
- 写入 `chapter_reviews`

```bash
npm run dev -- review --book 1 --chapter 12 --provider mock
```

### `repair`

作用：

- 根据当前 draft + 当前 review 生成新 draft 版本
- 保留修稿链路来源

```bash
npm run dev -- repair --book 1 --chapter 12 --provider mock
```

### `approve`

作用：

- 生成正式稿版本 `chapter_finals`
- 更新 `chapters.current_final_id`
- 抽取结构化事实 diff
- 回写人物、势力、关系、物品、钩子、世界设定的更新
- 更新章节实际关联实体信息

```bash
npm run dev -- approve --book 1 --chapter 12 --provider mock
```

## Markdown 导出与导入

### 导出

```bash
npm run dev -- chapter export --book 1 --chapter 12 --stage plan --output ./exports/ch12-plan.md
npm run dev -- chapter export --book 1 --chapter 12 --stage draft --output ./exports/ch12-draft.md
npm run dev -- chapter export --book 1 --chapter 12 --stage final --output ./exports/ch12-final.md
```

### 导入

```bash
npm run dev -- chapter import --book 1 --chapter 12 --stage plan --input ./exports/ch12-plan.md
npm run dev -- chapter import --book 1 --chapter 12 --stage draft --input ./exports/ch12-draft.md
npm run dev -- chapter import --book 1 --chapter 12 --stage final --input ./exports/ch12-final.md
```

关于正式稿导入，有两个关键点：

- 默认只有章节状态已经是 `approved` 时，才允许导入 `final`
- 如需跳过状态保护，可以追加 `--force`

```bash
npm run dev -- chapter import --book 1 --chapter 12 --stage final --input ./exports/ch12-final.md --force
```

## 常用查询命令

```bash
npm run dev -- chapter get --book 1 --chapter 12 --json
npm run dev -- character list --book 1 --json
npm run dev -- relation list --book 1 --json
npm run dev -- hook list --book 1 --json
npm run dev -- world list --book 1 --json
```

## 日志

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

## 测试

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

## 项目结构

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

## 当前状态

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
