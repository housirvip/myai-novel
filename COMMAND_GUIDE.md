# myai-novel 命令指南

这是一份面向实际使用的 CLI 命令手册，专门说明 [`novel`](src/cli.ts:13) 提供的全部命令、参数、典型示例与推荐执行顺序。

如果你只想快速了解项目，可以先看 [`README.md`](README.md)；如果你想系统掌握每一条命令，请以本文件为准。

---

## 1. 使用方式

本项目 CLI 名称为 `novel`，入口定义在 [`src/cli.ts`](src/cli.ts:10)。

你有两种常见运行方式：

### 方式一：开发模式直接运行

```bash
npm run dev -- <command>
```

例如：

```bash
npm run dev -- init --title "雾港回声" --genre "奇幻悬疑"
```

### 方式二：编译后运行

先构建：

```bash
npm run build
```

再运行：

```bash
node dist/cli.js <command>
```

例如：

```bash
node dist/cli.js book show
```

如果你已经全局安装或通过 `bin` 接入，也可以直接使用：

```bash
novel <command>
```

---

## 2. 命令总览

根据 [`src/cli.ts`](src/cli.ts:17) 的注册顺序，当前 CLI 分为以下几组：

- 项目初始化与总纲
  - `init`
  - `outline set`
  - `book show`
- 世界设定录入
  - `volume add`
  - `character add`
  - `location add`
  - `faction add`
  - `hook add`
  - `item add`
- 章节管理
  - `chapter add`
  - `chapter show <chapterId>`
  - `chapter rewrite <chapterId>`
  - `chapter approve <chapterId>`
- 工作流命令
  - `plan chapter <chapterId>`
  - `plan show <chapterId>`
  - `write next <chapterId>`
  - `draft show <chapterId>`
  - `review chapter <chapterId>`
  - `review show <chapterId>`
  - `rewrite show <chapterId>`
- 状态追踪
  - `story show`
  - `state show`
  - `state-updates show <chapterId>`

---

## 3. 推荐执行顺序

一个最典型的长篇写作流程如下：

1. `init`
2. `outline set`
3. `volume add`
4. `character add`
5. `location add`
6. `faction add`（可选）
7. `hook add`
8. `item add`
9. `chapter add`
10. `plan chapter`
11. `write next`
12. `review chapter`
13. `chapter rewrite`（按需）
14. `chapter approve`
15. `state show`

这个顺序对应了项目中“规划 → 写作 → 审查 → 重写 → 批准 → 状态沉淀”的主链路，核心实现分布在：

- [`src/core/planning/service.ts`](src/core/planning/service.ts)
- [`src/core/generation/service.ts`](src/core/generation/service.ts)
- [`src/core/review/service.ts`](src/core/review/service.ts)
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts)
- [`src/core/approve/service.ts`](src/core/approve/service.ts)

---

## 4. 项目初始化与总纲命令

命令定义主要位于 [`src/cli/commands/project-commands.ts`](src/cli/commands/project-commands.ts:19)。

### 4.1 `init`

初始化当前目录为一个新的小说项目。

#### 语法

```bash
novel init --title <title> --genre <genre> [--word-count <number>] [--tolerance <number>]
```

#### 参数

- `--title <title>`：书名，必填
- `--genre <genre>`：题材，必填
- `--word-count <number>`：默认章节字数，默认 `3000`
- `--tolerance <number>`：章节字数容忍比例，默认 `0.15`

#### 作用

执行后会：

- 创建项目目录结构
- 生成 `config/database.json`
- 创建 `data/novel.sqlite`
- 自动执行数据库迁移
- 创建第一本书的基础记录

目录生成逻辑见 [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:26)。

#### 示例

```bash
novel init \
  --title "测试之书" \
  --genre "奇幻冒险" \
  --word-count 2500 \
  --tolerance 0.2
```

---

### 4.2 `outline set`

为当前书籍设置总纲。

#### 语法

```bash
novel outline set \
  --premise <premise> \
  --theme <theme> \
  --worldview <worldview> \
  --core-conflict <items...> \
  --ending-vision <endingVision>
```

#### 参数

- `--premise <premise>`：故事前提
- `--theme <theme>`：主题
- `--worldview <worldview>`：世界观描述
- `--core-conflict <items...>`：一个或多个核心冲突
- `--ending-vision <endingVision>`：希望到达的结局方向

#### 示例

```bash
novel outline set \
  --premise "一名年轻抄写员得到会低语的古戒" \
  --theme "记忆、代价与自我选择" \
  --worldview "群岛王国中，古代符文与航海文明并存" \
  --core-conflict "保护家人" "追查戒指真相" \
  --ending-vision "主角理解古戒的代价并作出最终选择"
```

---

### 4.3 `book show`

查看当前书籍的基础信息和总纲摘要。

#### 语法

```bash
novel book show
```

#### 输出内容

- 书名
- 书籍 ID
- 题材
- 默认章节字数
- 容差比例
- 卷数量
- 章节数量
- 总纲前提与核心冲突

---

## 5. 世界设定命令

命令定义位于 [`src/cli/commands/world-commands.ts`](src/cli/commands/world-commands.ts:16)。

这些命令负责为后续规划、写作和审查提供结构化上下文。

### 5.1 `volume add`

新增一卷。

```bash
novel volume add --title <title> --goal <goal> --summary <summary>
```

参数：

- `--title <title>`：卷名
- `--goal <goal>`：该卷目标
- `--summary <summary>`：卷摘要

示例：

```bash
novel volume add \
  --title "第一卷：迷雾初航" \
  --goal "建立世界观与主线危机" \
  --summary "主角被迫踏上寻找遗迹的旅程"
```

---

### 5.2 `character add`

新增角色。

```bash
novel character add \
  --name <name> \
  --role <role> \
  --profile <profile> \
  --motivation <motivation>
```

参数：

- `--name <name>`：角色名
- `--role <role>`：角色定位，如主角、反派、导师
- `--profile <profile>`：人物简介
- `--motivation <motivation>`：核心动机

---

### 5.3 `location add`

新增地点。

```bash
novel location add --name <name> --type <type> --description <description>
```

参数：

- `--name <name>`：地点名
- `--type <type>`：地点类型
- `--description <description>`：地点描述

---

### 5.4 `faction add`

新增势力。

```bash
novel faction add \
  --name <name> \
  --type <type> \
  --objective <objective> \
  --description <description>
```

参数：

- `--name <name>`：势力名
- `--type <type>`：势力类型
- `--objective <objective>`：势力目标
- `--description <description>`：势力说明

---

### 5.5 `hook add`

新增伏笔 / 钩子。

```bash
novel hook add \
  --title <title> \
  --description <description> \
  --payoff-expectation <payoffExpectation> \
  [--priority <priority>] \
  [--source-chapter-id <sourceChapterId>]
```

参数：

- `--title <title>`：钩子标题
- `--description <description>`：钩子说明
- `--payoff-expectation <payoffExpectation>`：未来回收预期
- `--priority <priority>`：优先级，默认 `medium`
- `--source-chapter-id <sourceChapterId>`：来源章节 ID，可选

适合用于：

- 埋伏笔
- 记录悬念
- 跟踪尚未回收的剧情承诺

---

### 5.6 `item add`

新增物品，并初始化其当前状态。

```bash
novel item add \
  --name <name> \
  --unit <unit> \
  --type <type> \
  --description <description> \
  [--quantity <number>] \
  [--status <status>] \
  [--owner-character-id <ownerCharacterId>] \
  [--location-id <locationId>] \
  [--important] \
  [--unique]
```

参数：

- `--name <name>`：物品名
- `--unit <unit>`：数量单位，如“把”“枚”“卷”
- `--type <type>`：物品类型
- `--description <description>`：物品描述
- `--quantity <number>`：数量，默认 `1`
- `--status <status>`：状态描述，默认 `正常`
- `--owner-character-id <ownerCharacterId>`：持有角色 ID
- `--location-id <locationId>`：所在地点 ID
- `--important`：标记为关键物品
- `--unique`：标记为全局唯一物品

这个命令会同时影响物品定义和当前状态表，相关模型见 [`src/infra/db/schema.ts`](src/infra/db/schema.ts:260)。

---

## 6. 章节管理命令

命令定义位于 [`src/cli/commands/chapter-commands.ts`](src/cli/commands/chapter-commands.ts:32)。

### 6.1 `chapter add`

新增章节。

```bash
novel chapter add \
  --volume-id <volumeId> \
  --title <title> \
  --objective <objective> \
  [--planned-beat <items...>] \
  [--index <number>]
```

参数：

- `--volume-id <volumeId>`：所属卷 ID
- `--title <title>`：章节标题
- `--objective <objective>`：章节目标
- `--planned-beat <items...>`：章节计划节拍，可多个
- `--index <number>`：章节序号，可手动覆盖

示例：

```bash
novel chapter add \
  --volume-id volume_xxx \
  --title "灯塔前的抉择" \
  --objective "让主角发现关键证据并意识到自己被盯上" \
  --planned-beat "抵达旧灯塔" "发现铭文" "遭遇跟踪者"
```

---

### 6.2 `chapter show <chapterId>`

查看某一章当前状态及最新流程产物。

```bash
novel chapter show <chapterId>
```

典型输出包括：

- 章节标题与 ID
- 当前章节状态
- 当前计划版本号
- 当前正文版本号
- 最新 plan / draft / review / rewrite / final output 信息

适合用于快速判断这一章走到了哪一步。

---

### 6.3 `chapter rewrite <chapterId>`

基于最新草稿与审查结果重写该章节。

```bash
novel chapter rewrite <chapterId> [--goal <items...>] [--strategy <strategy>]
```

参数：

- `--goal <items...>`：一个或多个重写目标
- `--strategy <strategy>`：重写策略，`full` 或 `partial`，默认 `partial`

示例：

```bash
novel chapter rewrite chapter_xxx \
  --strategy full \
  --goal "补足目标字数" \
  --goal "强化结尾悬念"
```

如果没有显式传 `--goal`，系统会使用默认重写目标。

---

### 6.4 `chapter approve <chapterId>`

批准某章的最新已审查版本，并导出最终内容。

```bash
novel chapter approve <chapterId>
```

#### 重要前提

只有已处于 `reviewed` 状态的章节才能批准，这一校验位于 [`src/core/approve/service.ts`](src/core/approve/service.ts:85)。

#### 执行效果

执行后会：

- 将最终正文写入 `completed-chapters/`
- 创建章节输出记录
- 更新故事当前状态
- 更新角色、物品、钩子、记忆状态
- 写入状态追踪日志
- 把章节状态改为 `finalized`

批准后的导出文件名由 [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:66) 生成。

---

## 7. 工作流命令

命令定义位于 [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts:26)。

### 7.1 `plan chapter <chapterId>`

为章节生成规划。

```bash
novel plan chapter <chapterId>
```

#### 作用

它会聚合：

- 书籍信息
- 总纲
- 卷与章节信息
- 角色当前状态
- 物品当前状态
- 钩子当前状态
- 记忆系统

相关上下文拼装逻辑见 [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)。

#### 输出

- 计划版本号
- 章节目标
- 场景卡数量
- 事件纲要数量

---

### 7.2 `plan show <chapterId>`

查看最新章节规划详情。

```bash
novel plan show <chapterId>
```

可查看：

- `sceneCards`
- `eventOutline`
- `statePredictions`
- `memoryCandidates`

适合在真正开始写作前校验规划质量。

---

### 7.3 `write next <chapterId>`

根据最新计划生成下一版章节草稿。

```bash
novel write next <chapterId>
```

#### 输出

- 草稿 ID
- 章节状态
- 实际字数
- 下一步建议动作

写作逻辑位于 [`src/core/generation/service.ts`](src/core/generation/service.ts)。

---

### 7.4 `draft show <chapterId>`

查看章节的最新草稿。

```bash
novel draft show <chapterId>
```

通常用于：

- 人工检查草稿质量
- 快速复制正文
- 判断是否进入审查或重写

---

### 7.5 `review chapter <chapterId>`

审查最新草稿。

```bash
novel review chapter <chapterId>
```

#### 审查维度

依据 [`src/core/review/service.ts`](src/core/review/service.ts) 的设计，审查会覆盖：

- 一致性问题
- 人物问题
- 物品问题
- 记忆问题
- 节奏问题
- 钩子问题
- 字数检查
- 修订建议

#### 输出

- review ID
- 审查决策
- 字数是否通过
- 修订建议列表

---

### 7.6 `review show <chapterId>`

查看最新审查报告。

```bash
novel review show <chapterId>
```

如果你需要决定“是否重写、重写方向是什么”，这个命令最重要。

---

### 7.7 `rewrite show <chapterId>`

查看最新重写候选稿。

```bash
novel rewrite show <chapterId>
```

通常在执行完 `chapter rewrite` 之后使用，查看：

- 重写版本号
- 重写策略
- 实际字数
- 重写目标
- 内容预览

---

## 8. 状态追踪命令

命令定义位于 [`src/cli/commands/state-commands.ts`](src/cli/commands/state-commands.ts:21)。

这是本项目和一般“AI 一次性写文脚本”最大的区别之一。

### 8.1 `story show`

查看当前故事状态。

```bash
novel story show
```

适合快速看当前主线推进到了哪一章。

---

### 8.2 `state show`

查看当前书籍的规范化真源状态。

```bash
novel state show
```

#### 通常会输出

- 当前故事状态
- 角色当前状态
- 关键物品当前状态
- 钩子当前状态
- 短期记忆
- 长期记忆
- 最近状态更新记录
- 最近记忆更新记录
- 最近钩子更新记录

如果你在排查“角色瞬移”“物品丢失”“伏笔状态不对”“模型忘设定”等问题，这个命令非常关键。

---

### 8.3 `state-updates show <chapterId>`

查看某一章引发的状态更新记录。

```bash
novel state-updates show <chapterId>
```

会展示：

- 角色 / 物品状态更新
- 记忆更新
- 钩子更新

适合回答这类问题：

- 某个状态是在哪一章变的？
- 某个重要物品为什么现在在这个位置？
- 某条长期记忆是从哪章沉淀进来的？

---

## 9. 真实模型模式与兜底模式

LLM 创建逻辑位于 [`src/infra/llm/factory.ts`](src/infra/llm/factory.ts:5)。

### 9.1 真实模型模式

当环境变量中存在 `OPENAI_API_KEY` 时，系统会尝试创建真实 LLM 适配器，并通过 [`src/infra/llm/openai-adapter.ts`](src/infra/llm/openai-adapter.ts:21) 调用 OpenAI 兼容接口。

典型环境变量：

```env
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5
```

### 9.2 规则兜底模式

如果没有可用的 `OPENAI_API_KEY`，部分核心流程会退回规则式实现：

- 规划会有规则式 plan
- 草稿会有规则式 draft
- 审查会有规则式 review
- 重写会有规则式 rewrite

这样可以在本地无模型时依然完整测试主链路。

---

## 10. 常见完整示例

### 10.1 从空目录到第一章定稿

```bash
novel init --title "雾港回声" --genre "奇幻悬疑"

novel outline set \
  --premise "失忆调查员追查失踪案" \
  --theme "记忆与身份" \
  --worldview "蒸汽与秘术并存的港口都市" \
  --core-conflict "真相与自保" "秩序与自由" \
  --ending-vision "找回记忆，但付出代价"

novel volume add \
  --title "第一卷：灰雾潮声" \
  --goal "建立主线危机" \
  --summary "主角接触案件核心线索"

novel character add \
  --name "林澈" \
  --role "主角" \
  --profile "失忆调查员，观察敏锐" \
  --motivation "查清真相"

novel location add \
  --name "旧码头" \
  --type "港口" \
  --description "多起失踪案最后出现地"

novel hook add \
  --title "陌生签名" \
  --description "主角档案里出现自己的旧签名" \
  --payoff-expectation "后续揭露主角曾参与秘密行动" \
  --priority high

novel item add \
  --name "铜钥匙" \
  --unit "把" \
  --type "关键道具" \
  --description "刻有旧城区纹章" \
  --important \
  --unique

novel chapter add \
  --volume-id <volumeId> \
  --title "旧码头的失踪者" \
  --objective "让主角首次接触案件核心线索"

novel plan chapter <chapterId>
novel write next <chapterId>
novel review chapter <chapterId>
novel chapter rewrite <chapterId> --goal "增强节奏与结尾牵引"
novel chapter approve <chapterId>
novel state show
```

---

### 10.2 只检查某章当前状态

```bash
novel chapter show <chapterId>
novel plan show <chapterId>
novel draft show <chapterId>
novel review show <chapterId>
novel rewrite show <chapterId>
```

---

### 10.3 排查状态问题

```bash
novel state show
novel state-updates show <chapterId>
novel story show
```

---

## 11. 常见问题

### 11.1 为什么 `chapter approve` 执行失败？

最常见原因是章节还没有进入 `reviewed` 状态。请先执行：

```bash
novel review chapter <chapterId>
```

如果你还想优化质量，先执行：

```bash
novel chapter rewrite <chapterId>
```

---

### 11.2 为什么生成结果比较模板化？

通常是因为当前没有可用模型配置，系统走了规则兜底模式。请检查：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

环境变量读取逻辑见 [`src/shared/utils/env.ts`](src/shared/utils/env.ts:11)。

---

### 11.3 为什么状态里有些字段还是“未知”？

因为当前系统的状态更新部分依赖正文中是否包含足够明确的结构化线索；若正文没有显式声明角色位置、物品持有者等信息，系统会保留上一状态或写入默认说明。状态提交逻辑在 [`src/core/approve/service.ts`](src/core/approve/service.ts:117) 开始执行。

---

### 11.4 如何查看某条状态是从哪一章来的？

使用：

```bash
novel state-updates show <chapterId>
```

如果不知道是哪一章造成的，先用：

```bash
novel state show
```

查看最近更新记录。

---

## 12. 建议配套阅读

- [`README.md`](README.md)
- [`src/cli.ts`](src/cli.ts)
- [`src/cli/commands/project-commands.ts`](src/cli/commands/project-commands.ts)
- [`src/cli/commands/world-commands.ts`](src/cli/commands/world-commands.ts)
- [`src/cli/commands/chapter-commands.ts`](src/cli/commands/chapter-commands.ts)
- [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts)
- [`src/cli/commands/state-commands.ts`](src/cli/commands/state-commands.ts)

这几份文件一起看，基本就能完整理解当前 CLI 的使用方式和内部流程。
