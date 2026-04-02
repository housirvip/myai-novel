# myai-novel

一个面向长篇创作流程的 AI 小说 CLI 工具。

它不是只帮你“写一章”，而是把小说生产流程拆成结构化阶段：项目初始化、世界观录入、章节规划、草稿生成、审查、重写、定稿批准，以及章节完成后的状态沉淀与追踪。

当前版本特别强调“状态闭环”：人物位置、物品状态、伏笔状态、短期记忆、长期记忆都会进入后续章节的上下文，尽量减少长线写作时的人设漂移、设定遗忘和伏笔断裂。

## 核心能力

- 使用命令行管理小说项目、卷、章节和世界设定
- 通过 SQLite 保存书籍、章节、角色、地点、物品、钩子和状态数据
- 将章节流程拆分为 `plan`、`write`、`review`、`rewrite`、`approve`
- 在章节批准后沉淀故事状态、角色状态、物品状态、记忆和钩子更新
- 提供 `state show` 与 `state-updates show` 用于追踪当前真源状态和章节更新记录
- 支持接入 OpenAI 兼容接口；未配置 API 时，部分流程会退回规则式兜底逻辑

## 技术栈

- `TypeScript`
- `Node.js`
- `commander`
- `better-sqlite3`
- `zod`
- OpenAI 兼容 LLM 接口

## 环境要求

- `Node.js 20+`，建议使用较新的 LTS 版本
- `npm`

## 安装

```bash
npm install
```

可选：复制环境变量模板。

```bash
cp .env.example .env
```

`.env.example` 中当前支持的变量：

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5
```

说明：

- 如果配置了 `OPENAI_API_KEY`，规划、写作、审查、重写会优先调用模型
- 如果没有配置，系统会在部分环节使用内置规则式逻辑继续工作，便于本地调试流程

## 开发命令

```bash
npm run dev -- --help
npm run build
npm run check
```

- `npm run dev`：直接用 `tsx` 启动 CLI，适合本地开发
- `npm run build`：编译到 `dist/`
- `npm run check`：执行 TypeScript 类型检查

构建完成后，CLI 入口为：

```bash
novel
```

本地开发阶段更推荐直接使用：

```bash
npm run dev -- <command>
```

## 快速开始

下面是一条从 0 到 1 的最小工作流。

### 1. 初始化项目

在一个空目录中执行：

```bash
npm run dev -- init \
  --title "雾港回声" \
  --genre "奇幻悬疑" \
  --word-count 3000 \
  --tolerance 0.15
```

初始化后会自动创建这些目录和文件：

- `config/database.json`
- `data/novel.sqlite`
- `completed-chapters/`
- `exports/markdown/`
- `logs/`

### 2. 录入作品总纲

```bash
npm run dev -- outline set \
  --premise "一名失忆调查员在海港都市追查连续失踪案" \
  --theme "记忆与身份" \
  --worldview "蒸汽与秘术并存的港口都市" \
  --core-conflict "真相与自我保护" "秩序与自由" \
  --ending-vision "主角恢复记忆，但必须为真相付出代价"
```

### 3. 建立世界资料

先补卷、角色、地点，再补钩子和重要物品。

```bash
npm run dev -- volume add \
  --title "第一卷：灰雾潮声" \
  --goal "建立主线冲突与核心关系" \
  --summary "主角被卷入港口失踪案，并发现自己与旧档案有关"
```

```bash
npm run dev -- character add \
  --name "林澈" \
  --role "主角" \
  --profile "失忆调查员，观察敏锐但情绪压抑" \
  --motivation "找回记忆并查清失踪案真相"
```

```bash
npm run dev -- location add \
  --name "雾港旧码头" \
  --type "港口" \
  --description "潮雾终年不散，是多起失踪案最后出现地点"
```

```bash
npm run dev -- hook add \
  --title "主角旧档案里的陌生签名" \
  --description "主角在警方档案中发现疑似自己留下的签名" \
  --payoff-expectation "后续揭示主角曾参与秘密行动" \
  --priority high
```

```bash
npm run dev -- item add \
  --name "铜钥匙" \
  --unit "把" \
  --type "关键道具" \
  --description "刻着旧城区纹章的铜制钥匙" \
  --quantity 1 \
  --status "完好" \
  --important \
  --unique
```

### 4. 创建章节

```bash
npm run dev -- chapter add \
  --volume-id <volumeId> \
  --title "旧码头的失踪者" \
  --objective "让主角首次接触案件核心线索" \
  --planned-beat "抵达旧码头" "发现异常档案" "埋下新伏笔"
```

你可以先用下面命令确认书籍与章节状态：

```bash
npm run dev -- book show
npm run dev -- chapter show <chapterId>
```

### 5. 跑通章节工作流

```bash
npm run dev -- plan chapter <chapterId>
npm run dev -- plan show <chapterId>

npm run dev -- write next <chapterId>
npm run dev -- draft show <chapterId>

npm run dev -- review chapter <chapterId>
npm run dev -- review show <chapterId>

npm run dev -- chapter rewrite <chapterId> --goal "优化节奏" --goal "强化结尾钩子"
npm run dev -- rewrite show <chapterId>

npm run dev -- chapter approve <chapterId>
```

`approve` 是整个闭环里最关键的一步，它会：

- 输出章节最终内容
- 更新章节状态
- 写入故事当前状态
- 写入人物、物品、钩子、记忆的最新状态
- 记录本章的状态更新日志，供后续追溯

### 6. 查看状态闭环结果

```bash
npm run dev -- state show
npm run dev -- state-updates show <chapterId>
npm run dev -- story show
```

## 推荐工作流

适合连续写作时采用下面顺序：

1. `init`
2. `outline set`
3. `volume add`
4. `character add` / `location add` / `faction add` / `hook add` / `item add`
5. `chapter add`
6. `plan chapter`
7. `write next`
8. `review chapter`
9. `chapter rewrite`（如果需要）
10. `chapter approve`
11. `state show` 检查状态闭环是否符合预期

## 命令总览

### 项目与总纲

- `init`：初始化当前目录为小说项目
- `outline set`：设置作品总纲
- `book show`：查看书籍、总纲、卷与章节数量

### 世界设定

- `volume add`：新增卷
- `character add`：新增角色
- `location add`：新增地点
- `faction add`：新增势力
- `hook add`：新增伏笔 / 钩子
- `item add`：新增物品并初始化当前状态

### 章节管理

- `chapter add`：新增章节
- `chapter show <chapterId>`：查看章节当前状态与最新产物
- `chapter rewrite <chapterId>`：基于最新审查结果重写章节
- `chapter approve <chapterId>`：批准章节并导出最终内容

### 工作流命令

- `plan chapter <chapterId>`：生成章节规划
- `plan show <chapterId>`：查看最新规划
- `write next <chapterId>`：根据最新规划生成草稿
- `draft show <chapterId>`：查看最新草稿
- `review chapter <chapterId>`：审查最新草稿
- `review show <chapterId>`：查看最新审查结果
- `rewrite show <chapterId>`：查看最新重写结果

### 状态追踪

- `story show`：查看故事当前状态
- `state show`：查看当前书籍的规范化真源状态
- `state-updates show <chapterId>`：查看某章产生的状态、记忆、钩子更新记录

## 数据与状态模型

项目当前围绕下面几类核心实体工作：

- 书籍与总纲：`books`、`outlines`
- 结构拆分：`volumes`、`chapters`
- 世界设定：`characters`、`locations`、`factions`、`hooks`、`items`
- 章节产物：`chapter_plans`、`chapter_drafts`、`chapter_reviews`、`chapter_rewrites`、`chapter_outputs`
- 当前真源状态：`story_current_state`、`character_current_state`、`hook_current_state`、`item_current_state`
- 记忆系统：`short_term_memory_current`、`long_term_memory_current`
- 更新追踪：`chapter_state_updates`、`chapter_memory_updates`、`chapter_hook_updates`

这意味着系统不只保存“写出来的正文”，也保存“正文改变了什么”，这样下一章才能拿到真正可靠的上下文。

## 目录结构

### 源码目录

- `src/cli.ts`：CLI 入口
- `src/cli/commands/`：命令定义
- `src/core/`：规划、生成、审查、重写、批准等核心服务
- `src/infra/db/`：数据库连接、迁移与 schema
- `src/infra/repository/`：SQLite 仓储实现
- `src/infra/llm/`：LLM 适配层
- `src/shared/`：通用类型与工具函数

### 运行期目录

- `config/`：项目配置
- `data/`：SQLite 数据库
- `completed-chapters/`：批准后的章节文件
- `exports/markdown/`：导出内容
- `logs/`：日志目录

### 设计文档

- `plans/`：项目阶段性设计与拆解文档

## 适合什么场景

这个项目更适合下面的写作场景：

- 连载或长篇，需要持续维护人物、伏笔和世界状态
- 想把“灵感式写作”变成“可追踪流程”
- 想把 AI 写作从一次性生成，升级为带上下文和状态记忆的流水线

## 当前阶段说明

当前仓库更偏向一个可演进的写作引擎原型，已经具备完整的章节主链路与状态闭环基础设施，但仍然适合在本地逐步打磨流程、提示词和命令体验。

如果你想继续扩展，比较自然的方向包括：

- 增加更多查询与编辑命令
- 改进 prompt 和模型输出约束
- 增强导出格式
- 增加测试与示例项目
- 提供交互式 TUI 或 Web 管理界面
