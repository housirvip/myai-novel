# 命令行使用指南

## 目录

- [1. 工具定位](#1-工具定位)
- [2. 环境要求](#2-环境要求)
- [3. 基础配置](#3-基础配置)
- [4. 初始化数据库](#4-初始化数据库)
- [5. 帮助与通用规则](#5-帮助与通用规则)
- [6. 常用调用方式](#6-常用调用方式)
- [7. 命令总览](#7-命令总览)
- [8. 书籍管理](#8-书籍管理)
- [9. 设定资源管理](#9-设定资源管理)
- [10. 章节管理](#10-章节管理)
- [11. 章节工作流](#11-章节工作流)
- [12. Markdown 导出与导入](#12-markdown-导出与导入)
- [13. 5 分钟快速开始](#13-5-分钟快速开始)
- [14. 常见建议](#14-常见建议)
- [15. 推荐查阅文档](#15-推荐查阅文档)

本文整理 `myai-novel` 的命令行使用方式，适合作为日常查阅入口。内容基于当前 CLI 实现与项目配置，覆盖安装、初始化、资源管理、章节工作流、Markdown 导入导出等常见操作。

## 1. 工具定位

`myai-novel` 是一个面向长篇小说创作流程的 AI CLI 工具，核心能力包括：

- 书籍与设定资源管理
- 章节规划、起草、审阅、修订、定稿工作流
- 设定召回与上下文拼接
- 正文与设定库的事实回写
- `plan / draft / final` 的 Markdown 导出与导入

CLI 程序名为 `novel`，开发阶段通常通过以下方式调用：

```bash
npm run dev -- <command>
```

构建完成后可直接运行：

```bash
npm run build
node dist/index.js <command>
```

如果已安装为全局可执行程序，也可以直接使用：

```bash
novel <command>
```

## 2. 环境要求

- Node.js `>= 20`
- npm `>= 10`

安装依赖：

```bash
npm install
```

## 3. 基础配置

复制环境变量模板：

```bash
cp .env.example .env
```

一个最小可运行配置如下：

```dotenv
DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=mock
MOCK_LLM_MODE=echo

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_LLM_CONTENT_ENABLED=false
```

常用说明：

- `DB_CLIENT` 当前主要使用 `sqlite`
- `DB_SQLITE_PATH` 指定本地数据库文件路径
- `LLM_PROVIDER=mock` 适合本地调试、联调、演示
- `LOG_LLM_CONTENT_ENABLED=true` 会记录 AI 输入输出内容，默认建议关闭
- 切换到 `openai`、`anthropic`、`custom` 时，需要在 `.env` 中补齐对应配置

## 4. 初始化数据库

首次使用建议先初始化并检查数据库：

```bash
npm run dev -- db init
npm run dev -- db check
```

如需显式执行迁移：

```bash
npm run dev -- db migrate
```

## 5. 帮助与通用规则

查看全局帮助：

```bash
npm run dev -- --help
npm run dev -- help
```

查看某个命令的帮助：

```bash
npm run dev -- chapter --help
npm run dev -- chapter help create
```

通用规则：

- 大多数查询类和工作流命令支持 `--json`
- `--provider` 可覆盖默认 LLM provider
- `--model` 可覆盖默认模型
- 需要传多个 ID 的参数，通常支持两种形式：
  - 逗号分隔：`1,2,3`
  - JSON 数组：`[1,2,3]`

## 6. 常用调用方式

开发态最常见：

```bash
npm run dev -- book list
npm run dev -- chapter list --book 1
npm run dev -- plan --book 1 --chapter 1 --provider mock
```

构建后调用：

```bash
npm run build
node dist/index.js book list
node dist/index.js plan --book 1 --chapter 1 --provider mock
```

## 7. 命令总览

当前 CLI 主要命令如下：

- `db`：数据库工具
- `book`：书籍管理
- `outline`：大纲管理
- `world`：世界设定管理
- `character`：人物管理
- `faction`：势力管理
- `relation`：关系管理
- `item`：物品管理
- `hook`：故事钩子管理
- `chapter`：章节管理与 Markdown 导入导出
- `plan`：规划章节
- `draft`：生成草稿
- `review`：审阅草稿
- `repair`：根据审阅修订草稿
- `approve`：定稿并回写事实

## 8. 书籍管理

### 创建书籍

```bash
npm run dev -- book create \
  --title "青岳入门录" \
  --summary "一个寒门少年携异令入宗的成长故事" \
  --targetChapters 200
```

常用参数：

- `--title`：书名，必填
- `--summary`：书籍简介
- `--targetChapters`：预期章节数
- `--status`：书籍状态，默认 `planning`
- `--json`：JSON 输出

### 查询与更新

```bash
npm run dev -- book list
npm run dev -- book get --id 1
npm run dev -- book update --id 1 --status writing
```

## 9. 设定资源管理

### 9.1 大纲

创建大纲：

```bash
npm run dev -- outline create \
  --book 1 \
  --title "入宗篇" \
  --chapterStart 1 \
  --chapterEnd 10 \
  --storyCore "主角带着异常令牌进入宗门"
```

常用字段：

- `--volumeNo`、`--volumeTitle`
- `--chapterStart`、`--chapterEnd`
- `--level`，默认 `chapter_arc`
- `--storyCore`、`--mainPlot`、`--subPlot`
- `--foreshadowing`、`--expectedPayoff`、`--notes`

### 9.2 世界设定

```bash
npm run dev -- world create \
  --book 1 \
  --title "宗门制度" \
  --category "势力规则" \
  --content "外门弟子通过令牌登记入门" \
  --keywords "宗门,外门,令牌"
```

关键参数：

- `--title`、`--category`、`--content` 必填
- `--status` 默认 `active`
- `--appendNotes` 追加说明
- `--keywords` 支持逗号分隔或 JSON 数组

### 9.3 人物

```bash
npm run dev -- character create \
  --book 1 \
  --name "林夜" \
  --background "出身寒门" \
  --goal "进入青岳宗并查清令牌来历" \
  --keywords "林夜,主角"
```

常用字段：

- `--alias`、`--gender`、`--age`
- `--personality`、`--background`、`--location`
- `--status` 默认 `alive`
- `--professions`、`--levels`、`--currencies`、`--abilities`
- `--goal`、`--appendNotes`、`--keywords`

### 9.4 势力

```bash
npm run dev -- faction create \
  --book 1 \
  --name "青岳宗" \
  --category "宗门" \
  --headquarter "青岳山" \
  --keywords "青岳宗,外门"
```

### 9.5 关系

```bash
npm run dev -- relation create \
  --book 1 \
  --sourceType character \
  --sourceId 1 \
  --targetType faction \
  --targetId 1 \
  --relationType member \
  --keywords "林夜,外门"
```

关键参数：

- `--sourceType`、`--sourceId`
- `--targetType`、`--targetId`
- `--relationType`
- `--intensity` 建议填 `0-100`
- `--status` 默认 `active`

### 9.6 物品

```bash
npm run dev -- item create \
  --book 1 \
  --name "黑铁令" \
  --ownerType none \
  --keywords "黑铁令,令牌"
```

### 9.7 故事钩子

```bash
npm run dev -- hook create \
  --book 1 \
  --title "黑铁令异常" \
  --hookType mystery \
  --sourceChapter 1 \
  --keywords "黑铁令,异常"
```

### 9.8 通用查询操作

大多数资源都支持以下模式：

```bash
npm run dev -- character list --book 1
npm run dev -- character get --id 1
npm run dev -- character update --id 1 --location "青岳宗外门"
npm run dev -- character delete --id 1
```

同类命令适用于：

- `outline`
- `world`
- `character`
- `faction`
- `relation`
- `item`
- `hook`

## 10. 章节管理

### 创建章节

```bash
npm run dev -- chapter create \
  --book 1 \
  --chapter 1 \
  --title "黑铁令"
```

常用参数：

- `--book`：书籍 ID，必填
- `--chapter`：章节号，必填
- `--title`：章节标题
- `--summary`：章节总结
- `--wordCount`：字数
- `--status`：默认 `todo`
- `--characterIds`、`--factionIds`、`--itemIds`、`--hookIds`、`--worldSettingIds`

### 查询、更新、删除

```bash
npm run dev -- chapter list --book 1
npm run dev -- chapter get --book 1 --chapter 1
npm run dev -- chapter update --book 1 --chapter 1 --status drafting
npm run dev -- chapter delete --book 1 --chapter 1
```

## 11. 章节工作流

### 11.1 `plan`

作用：

- 读取作者意图
- 在需要时自动生成作者意图草案
- 提取关键词并召回相关设定
- 生成结构化章节规划并写入 `chapter_plans`

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

常用参数：

- `--book`、`--chapter`：必填
- `--authorIntent`：作者意图，不传时系统可尝试自动生成
- `--characterIds`、`--factionIds`、`--relationIds`、`--itemIds`、`--hookIds`、`--worldSettingIds`
- `--provider`、`--model`
- `--json`

### 11.2 `draft`

作用：

- 基于当前 plan 和召回上下文生成章节草稿
- 写入 `chapter_drafts`

示例：

```bash
npm run dev -- draft --book 1 --chapter 12 --provider mock
npm run dev -- draft --book 1 --chapter 12 --provider anthropic --targetWords 3000
```

### 11.3 `review`

作用：

- 审查当前草稿的设定一致性、人物行为、节奏和逻辑
- 写入 `chapter_reviews`

```bash
npm run dev -- review --book 1 --chapter 12 --provider mock
```

### 11.4 `repair`

作用：

- 基于当前 `draft + review` 生成新的草稿版本
- 保留修稿链路

```bash
npm run dev -- repair --book 1 --chapter 12 --provider mock
```

### 11.5 `approve`

作用：

- 生成正式稿 `chapter_finals`
- 更新 `chapters.current_final_id`
- 抽取结构化事实 diff
- 回写人物、势力、关系、物品、钩子、世界设定的变更
- 更新章节摘要、字数和 `actual_*_ids`
- 重算 `books.current_chapter_count`

```bash
npm run dev -- approve --book 1 --chapter 12 --provider mock
```

仅预览、不写库：

```bash
npm run dev -- approve --book 1 --chapter 12 --provider mock --dryRun
```

`--dryRun` 的实际行为是：

- 仍然会调用模型生成 final 正文
- 仍然会调用模型抽取结构化 diff
- 但不会写入 `chapter_finals`
- 也不会创建或更新任何实体
- 也不会更新 `chapters.current_final_id`、`chapters.summary`、`chapters.actual_*_ids`
- 也不会更新 `books.current_chapter_count`

它更适合拿来做“定稿前预览”和“验证 diff 结构是否合理”，而不是做半提交。

补充说明：

- `approve` 正式提交时，会把 diff 中新建的实体并入章节的 `actual_*_ids`
- `approve` 产生的新正式稿会新增一条 `chapter_finals`，不会覆盖旧版本
- 如果模型生成期间该章节的 `current_plan_id / current_draft_id / current_review_id` 被其他操作切换，提交阶段会直接失败，避免把结果落到过期上下文上

## 12. Markdown 导出与导入

### 导出章节内容

支持导出 `plan`、`draft`、`final` 三个阶段：

```bash
npm run dev -- chapter export --book 1 --chapter 12 --stage plan --output ./exports/chapter-0012-plan.md
npm run dev -- chapter export --book 1 --chapter 12 --stage draft --output ./exports/chapter-0012-draft.md
npm run dev -- chapter export --book 1 --chapter 12 --stage final --output ./exports/chapter-0012-final.md
```

### 导入章节内容

```bash
npm run dev -- chapter import --book 1 --chapter 12 --stage plan --input ./exports/chapter-0012-plan.md
npm run dev -- chapter import --book 1 --chapter 12 --stage draft --input ./exports/chapter-0012-draft.md
npm run dev -- chapter import --book 1 --chapter 12 --stage final --input ./exports/chapter-0012-final.md
```

补充说明：

- `--stage` 只支持 `plan | draft | final`
- 不传 `--output` / `--input` 时，默认使用当前目录下的 `chapter-0001-plan.md` 这类 4 位零填充命名
- 导入会生成新版本，不是直接覆盖旧数据
- `--force` 可忽略状态保护并强制导入
- 正式稿 `final` 导入通常应在章节已经处于允许状态时使用

## 13. 5 分钟快速开始

如果你想快速打通一遍流程，可以按下面顺序操作。

### 方案：手动创建最小资源

```bash
npm run dev -- db init
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

然后继续执行完整章节工作流：

```bash
npm run dev -- plan --book 1 --chapter 1 --provider mock --authorIntent "让林夜带着黑铁令入宗，并引出宗门旧案线索。"
npm run dev -- draft --book 1 --chapter 1 --provider mock
npm run dev -- review --book 1 --chapter 1 --provider mock
npm run dev -- repair --book 1 --chapter 1 --provider mock
npm run dev -- approve --book 1 --chapter 1 --provider mock
```

## 14. 常见建议

- 本地联调优先使用 `--provider mock`
- 正式进入创作流程前，先保证 `db init` 和 `db check` 成功
- 想稳定召回关键设定时，优先在 `plan` 阶段显式传入实体 ID
- 需要人工精修正文时，优先使用 `chapter export` / `chapter import`
- 想和脚本或其他工具集成时，优先为命令增加 `--json`

## 15. 推荐查阅文档

如需进一步了解工作流内部机制，可继续阅读：

- `docs/chapter-pipeline-overview.md`
- `docs/prompt-retrieval-relationship.md`
- `docs/retrieval-pipeline-guide.md`

## 相关阅读

- [`README.md`](../README.md)
- [`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
- [`docs/retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)

## 阅读导航

- 上一篇：[`docs/README.md`](./README.md)
- 下一篇：[`docs/env-config-guide.md`](./env-config-guide.md)
