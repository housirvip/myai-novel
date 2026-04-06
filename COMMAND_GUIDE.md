# myai-novel 命令指南

这份文档按当前 CLI 源码逐项整理，目标是和 [`src/cli.ts`](src/cli.ts) 以及各命令注册文件保持一一对应。

如果你只想快速浏览项目，先看 [`README.md`](README.md)；如果你要确认某条命令到底支不支持、参数是什么、应该放在哪个流程里，请以本文件为准。

---

## 1. 运行方式

CLI 名称是 `novel`，入口在 [`src/cli.ts`](src/cli.ts)。

常见运行方式有三种：

### 1.1 开发模式

```bash
npm run dev -- <command>
```

例如：

```bash
npm run dev -- init --title "雾港回声" --genre "奇幻悬疑"
```

### 1.2 构建后运行

```bash
npm run build
node dist/cli.js <command>
```

例如：

```bash
node dist/cli.js book show
```

### 1.3 使用 bin 入口

```bash
novel <command>
```

查看帮助：

```bash
novel --help
novel chapter --help
novel doctor volume --help
```

---

## 2. 命令总览

当前 CLI 共有这些命令分组。

### 2.1 项目与总纲

- `init`
- `outline set`
- `book show`

### 2.2 世界设定

- `volume add`
- `character add`
- `location add`
- `faction add`
- `hook add`
- `item add`

### 2.3 章节管理

- `chapter add`
- `chapter show <chapterId>`
- `chapter rewrite <chapterId>`
- `chapter approve <chapterId>`
- `chapter drop <chapterId>`

### 2.4 工作流

- `plan chapter <chapterId>`
- `plan show <chapterId>`
- `plan mission-show <chapterId>`
- `plan volume-window <chapterId>`
- `plan volume-show <volumeId>`
- `write next <chapterId>`
- `draft show <chapterId>`
- `review chapter <chapterId>`
- `review show <chapterId>`
- `review volume <volumeId>`
- `rewrite show <chapterId>`

### 2.5 状态追踪

- `story show`
- `state show`
- `state threads [volumeId]`
- `state ending`
- `state volume-plan <volumeId>`
- `state volume <volumeId>`
- `state-updates show <chapterId>`

### 2.6 诊断、回归、快照

- `doctor`
- `doctor chapter <chapterId>`
- `doctor volume <volumeId>`
- `regression list`
- `regression run <caseName> [targetId]`
- `regression volume <volumeId>`
- `snapshot state`
- `snapshot chapter <chapterId>`
- `snapshot volume <volumeId>`

---

## 3. 推荐执行顺序

一个典型流程通常是：

1. `init`
2. `outline set`
3. `volume add`
4. `character add`
5. `location add`
6. `faction add` 或 `hook add` 或 `item add`
7. `chapter add`
8. `plan chapter <chapterId>`
9. `plan volume-window <chapterId>`
10. `plan mission-show <chapterId>` 或 `plan volume-show <volumeId>`
11. `write next <chapterId>`
12. `review chapter <chapterId>`
13. `review volume <volumeId>`
14. `chapter rewrite <chapterId>`，按需执行
15. `chapter approve <chapterId>`
16. `state show`
17. `state threads [volumeId]` / `state ending` / `state volume <volumeId>`
18. `doctor`
19. `doctor chapter <chapterId>` 或 `doctor volume <volumeId>`
20. `snapshot chapter <chapterId>` 或 `snapshot volume <volumeId>`
21. `regression run <caseName> [targetId]` 或 `regression volume <volumeId>`
22. `chapter drop <chapterId>`，仅在需要安全清理当前链路时使用

---

## 4. 项目与总纲命令

源码入口见 [`src/cli/commands/project-commands.ts`](src/cli/commands/project-commands.ts)。

### 4.1 `init`

初始化当前目录为一个小说项目。

```bash
novel init \
  --title <title> \
  --genre <genre> \
  [--word-count <number>] \
  [--tolerance <number>] \
  [--db-client <sqlite|mysql>] \
  [--db-filename <filename>] \
  [--db-host <host>] \
  [--db-port <port>] \
  [--db-user <user>] \
  [--db-password <password>] \
  [--db-name <name>]
```

参数：

- `--title <title>`：书名，必填
- `--genre <genre>`：题材，必填
- `--word-count <number>`：默认章节字数，默认 `3000`
- `--tolerance <number>`：章节字数容忍比例，默认 `0.15`
- `--db-client <sqlite|mysql>`：数据库后端，默认 `sqlite`
- `--db-filename <filename>`：SQLite 文件名，默认 `data/novel.sqlite`
- `--db-host <host>`：MySQL 主机，默认 `127.0.0.1`
- `--db-port <port>`：MySQL 端口，默认 `3306`
- `--db-user <user>`：MySQL 用户，默认 `root`
- `--db-password <password>`：MySQL 密码，可选
- `--db-name <name>`：MySQL 数据库名，默认 `myai_novel`

这个命令会：

- 创建项目目录
- 写入 `config/database.json`
- 打开并初始化数据库
- 运行迁移
- 创建第一本书的基础记录

示例：

```bash
novel init \
  --title "测试之书" \
  --genre "奇幻冒险" \
  --word-count 2500 \
  --tolerance 0.2
```

```bash
novel init \
  --title "测试之书" \
  --genre "奇幻冒险" \
  --db-client mysql \
  --db-host 127.0.0.1 \
  --db-port 3306 \
  --db-user root \
  --db-password secret \
  --db-name myai_novel
```

### 4.2 `outline set`

设置书籍总纲。

```bash
novel outline set \
  --premise <premise> \
  --theme <theme> \
  --worldview <worldview> \
  --core-conflict <items...> \
  --ending-vision <endingVision>
```

参数：

- `--premise <premise>`：故事前提
- `--theme <theme>`：主题
- `--worldview <worldview>`：世界观
- `--core-conflict <items...>`：一个或多个核心冲突
- `--ending-vision <endingVision>`：结局方向

示例：

```bash
novel outline set \
  --premise "一名年轻抄写员得到会低语的古戒" \
  --theme "记忆、代价与自我选择" \
  --worldview "群岛王国中，古代符文与航海文明并存" \
  --core-conflict "保护家人" "追查戒指真相" \
  --ending-vision "主角理解古戒的代价并作出最终选择"
```

### 4.3 `book show`

查看当前书籍和总纲摘要。

```bash
novel book show
```

通常会输出：

- 书名与书籍 ID
- 题材
- 默认章节字数
- 容差比例
- 卷数量
- 章节数量
- 总纲前提和核心冲突摘要

---

## 5. 世界设定命令

源码入口见 [`src/cli/commands/world-commands.ts`](src/cli/commands/world-commands.ts)。

### 5.1 `volume add`

新增一卷。

```bash
novel volume add --title <title> --goal <goal> --summary <summary>
```

参数：

- `--title <title>`：卷名
- `--goal <goal>`：卷目标
- `--summary <summary>`：卷摘要

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
- `--role <role>`：角色定位
- `--profile <profile>`：人物简介
- `--motivation <motivation>`：核心动机

### 5.3 `location add`

新增地点。

```bash
novel location add --name <name> --type <type> --description <description>
```

参数：

- `--name <name>`：地点名
- `--type <type>`：地点类型
- `--description <description>`：地点描述

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

- `--title <title>`：标题
- `--description <description>`：说明
- `--payoff-expectation <payoffExpectation>`：未来回收预期
- `--priority <priority>`：优先级，默认 `medium`
- `--source-chapter-id <sourceChapterId>`：来源章节 ID，可选

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
- `--unit <unit>`：数量单位
- `--type <type>`：物品类型
- `--description <description>`：物品描述
- `--quantity <number>`：数量，默认 `1`
- `--status <status>`：状态描述，默认 `正常`
- `--owner-character-id <ownerCharacterId>`：当前持有角色 ID
- `--location-id <locationId>`：当前地点 ID
- `--important`：标记为关键物品
- `--unique`：标记为全局唯一物品

---

## 6. 章节管理命令

源码入口见 [`src/cli/commands/chapter/register.ts`](src/cli/commands/chapter/register.ts)。

### 6.1 `chapter add`

新增章节主记录。

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
- `--planned-beat <items...>`：计划节拍，可多个
- `--index <number>`：手动指定章节序号

### 6.2 `chapter show <chapterId>`

查看章节当前状态和最新流程产物。

```bash
novel chapter show <chapterId>
```

通常会汇总：

- 章节主记录
- 最新 `plan`
- 最新 `draft`
- 最新 `review`
- 最新 `rewrite`
- 最新 `final output`
- 最新 outcome / debt / contradiction / updates 摘要

### 6.3 `chapter rewrite <chapterId>`

基于最新草稿执行重写。

```bash
novel chapter rewrite <chapterId> [--goal <items...>] [--strategy <strategy>]
```

参数：

- `--goal <items...>`：一个或多个重写目标
- `--strategy <strategy>`：`full` 或 `partial`，默认 `partial`

说明：

- 如果不传 `--goal`，CLI 会使用默认目标：`优化节奏与结尾牵引`

### 6.4 `chapter approve <chapterId>`

批准最新审查结果，并导出最终正文。

```bash
novel chapter approve <chapterId> [--force]
```

参数：

- `--force`：即使最新 review 风险较高，也继续批准

执行后通常会：

- 生成最终输出
- 更新章节状态
- 更新 story / state / memory / hook / thread / ending 相关投影

### 6.5 `chapter drop <chapterId>`

安全清理当前章节的计划链或草稿链。

```bash
novel chapter drop <chapterId> [--plan-only | --draft-only | --all-current] [--force]
```

参数：

- `--plan-only`：只丢弃当前 plan
- `--draft-only`：只丢弃当前 draft 链
- `--all-current`：同时丢弃当前 plan 和当前 draft 链
- `--force`：允许对 `finalized` 章节或已有最终输出的章节执行 drop

说明：

- `--plan-only`、`--draft-only`、`--all-current` 三者互斥
- 如果三者都不传，默认按 `--all-current` 处理

示例：

```bash
novel chapter drop <chapterId> --all-current
novel chapter drop <chapterId> --plan-only
novel chapter drop <chapterId> --draft-only --force
```

---

## 7. 工作流命令

源码入口见 [`src/cli/commands/workflow/register.ts`](src/cli/commands/workflow/register.ts)。

### 7.1 `plan chapter <chapterId>`

为某章生成计划。

```bash
novel plan chapter <chapterId>
```

输出重点通常包括：

- 计划版本号
- 章节目标
- 场景卡数量
- hook 规划数量
- 状态预测数量

### 7.2 `plan show <chapterId>`

查看该章最新计划详情。

```bash
novel plan show <chapterId>
```

常用来检查：

- `sceneCards`
- `eventOutline`
- `statePredictions`
- `memoryCandidates`

### 7.3 `plan mission-show <chapterId>`

查看某章在最新卷窗口计划中的 mission。

```bash
novel plan mission-show <chapterId>
```

适合回答：

- 这一章在当前卷窗口里的职责是什么
- 当前章节应该推进哪条主线或伏笔

### 7.4 `plan volume-window <chapterId>`

以某章为锚点，生成并持久化 rolling volume window。

```bash
novel plan volume-window <chapterId>
```

输出重点通常包括：

- volume plan ID
- volume ID
- 线程数量
- chapter mission 数量

### 7.5 `plan volume-show <volumeId>`

查看某卷最新的 rolling volume window。

```bash
novel plan volume-show <volumeId>
```

### 7.6 `write next <chapterId>`

根据最新计划生成下一版草稿。

```bash
novel write next <chapterId>
```

输出重点通常包括：

- draft ID
- 章节状态
- 实际字数
- 下一步推荐动作

### 7.7 `draft show <chapterId>`

查看章节最新草稿。

```bash
novel draft show <chapterId>
```

这个命令会直接输出草稿正文预览，适合人工阅读。

### 7.8 `review chapter <chapterId>`

审查最新草稿。

```bash
novel review chapter <chapterId>
```

输出重点通常包括：

- review ID
- 审查决策
- approval risk
- 问题数量
- closure suggestions 摘要

### 7.9 `review show <chapterId>`

查看最新审查报告。

```bash
novel review show <chapterId>
```

### 7.10 `review volume <volumeId>`

查看卷级审查摘要。

```bash
novel review volume <volumeId>
```

这个视图会聚合：

- volume plan
- threads
- ending readiness
- 该卷章节 review

### 7.11 `rewrite show <chapterId>`

查看最新重写候选稿。

```bash
novel rewrite show <chapterId>
```

---

## 8. 状态追踪命令

源码入口见 [`src/cli/commands/state/register.ts`](src/cli/commands/state/register.ts)。

### 8.1 `story show`

查看最核心的 story state。

```bash
novel story show
```

说明：

- 这是保留的旧入口
- 适合快速看全局故事游标

### 8.2 `state show`

查看当前书籍的 canonical state 投影。

```bash
novel state show
```

通常会包含：

- story state
- 角色当前状态
- 物品当前状态
- hooks 当前状态
- memory 摘要
- 最近状态更新记录

### 8.3 `state threads [volumeId]`

查看活跃故事线程和最近推进情况。

```bash
novel state threads [volumeId]
```

说明：

- 不传 `volumeId` 时看整书
- 传 `volumeId` 时聚焦某卷

### 8.4 `state ending`

查看整书当前的 ending readiness 和 closure 状态。

```bash
novel state ending
```

### 8.5 `state volume-plan <volumeId>`

查看状态层消费到的最新卷计划和 mission window。

```bash
novel state volume-plan <volumeId>
```

### 8.6 `state volume <volumeId>`

查看卷级状态、规划和线程摘要。

```bash
novel state volume <volumeId>
```

### 8.7 `state-updates show <chapterId>`

查看某章写入的状态更新痕迹。

```bash
novel state-updates show <chapterId>
```

通常会展示：

- state updates
- memory updates
- hook updates

---

## 9. 诊断、回归、快照命令

### 9.1 `doctor`

项目级诊断入口。

```bash
novel doctor
```

说明：

- 已初始化项目时，输出 project-level diagnostics
- 未初始化项目时，也会尽量输出 bootstrap 诊断，帮助检查 `config/database.json`、provider、backend 等基础配置

源码见 [`src/cli/commands/doctor/register.ts`](src/cli/commands/doctor/register.ts) 和 [`src/cli/commands/doctor/project.ts`](src/cli/commands/doctor/project.ts)。

### 9.2 `doctor chapter <chapterId>`

查看单章诊断结果。

```bash
novel doctor chapter <chapterId>
```

### 9.3 `doctor volume <volumeId>`

查看单卷诊断结果。

```bash
novel doctor volume <volumeId> [--json] [--strict]
```

参数：

- `--json`：输出原始 JSON 诊断结果
- `--strict`：如果存在 high risk，则以退出码 `1` 结束

### 9.4 `regression list`

列出内建回归 case。

```bash
novel regression list
```

当前内建 case 名称来自 [`src/cli/commands/regression/cases.ts`](src/cli/commands/regression/cases.ts)：

- `llm-provider-smoke`
- `secondary-provider-smoke`
- `database-backend-smoke`
- `sqlite-backend-smoke`
- `mysql-backend-smoke`
- `mixed-config-validation`
- `hook-pressure-smoke`
- `chapter-drop-safety`
- `review-layering-smoke`
- `volume-plan-smoke`
- `mission-carry-smoke`
- `thread-progression-smoke`
- `ending-readiness-smoke`
- `volume-doctor-smoke`

### 9.5 `regression run <caseName> [targetId]`

执行单个回归 case。

```bash
novel regression run <caseName> [targetId]
```

说明：

- 有些 case 不需要项目上下文，可以直接运行
- 需要章节或卷目标的 case，需要提供 `targetId`

当前无需项目即可运行的 case 包括：

- `llm-provider-smoke`
- `secondary-provider-smoke`
- `database-backend-smoke`
- `sqlite-backend-smoke`
- `mysql-backend-smoke`
- `mixed-config-validation`

示例：

```bash
novel regression run llm-provider-smoke
novel regression run database-backend-smoke
novel regression run volume-plan-smoke <volumeId>
novel regression run mission-carry-smoke <chapterId>
```

### 9.6 `regression volume <volumeId>`

执行内建卷级回归套件。

```bash
novel regression volume <volumeId>
```

当前卷级套件包含：

- `volume-plan-smoke`
- `thread-progression-smoke`
- `ending-readiness-smoke`
- `volume-doctor-smoke`

### 9.7 `snapshot state`

输出当前项目的状态快照。

```bash
novel snapshot state
```

### 9.8 `snapshot chapter <chapterId>`

输出单章 workflow 快照。

```bash
novel snapshot chapter <chapterId>
```

### 9.9 `snapshot volume <volumeId>`

输出卷级 workflow 快照。

```bash
novel snapshot volume <volumeId>
```

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
novel plan volume-window <chapterId>
novel plan mission-show <chapterId>
novel write next <chapterId>
novel review chapter <chapterId>
novel chapter rewrite <chapterId> --goal "增强节奏与结尾牵引"
novel chapter approve <chapterId>
novel state show
```

### 10.2 查看某章当前链路

```bash
novel chapter show <chapterId>
novel plan show <chapterId>
novel draft show <chapterId>
novel review show <chapterId>
novel rewrite show <chapterId>
novel state-updates show <chapterId>
novel snapshot chapter <chapterId>
```

### 10.3 查看某卷当前链路

```bash
novel plan volume-show <volumeId>
novel review volume <volumeId>
novel state threads <volumeId>
novel state volume-plan <volumeId>
novel state volume <volumeId>
novel doctor volume <volumeId>
novel snapshot volume <volumeId>
novel regression volume <volumeId>
```

### 10.4 基础设施验收

```bash
novel doctor
novel regression list
novel regression run llm-provider-smoke
novel regression run secondary-provider-smoke
novel regression run mixed-config-validation
novel regression run sqlite-backend-smoke
novel regression run mysql-backend-smoke
novel regression run database-backend-smoke
```

---

## 11. 常见问题

### 11.1 为什么 `chapter approve` 会失败？

通常是因为当前章节还没有到可以批准的状态，或者最新 review 风险过高。常见排查顺序：

```bash
novel review chapter <chapterId>
novel review show <chapterId>
novel chapter show <chapterId>
```

如果你明确要跳过高风险限制，再考虑：

```bash
novel chapter approve <chapterId> --force
```

### 11.2 `story show` 和 `state show` 有什么区别？

- `story show`：更轻量，只看核心 story state
- `state show`：更完整，查看 canonical state 投影

### 11.3 如何追查“某个状态到底是哪一章改的”？

先看整书状态：

```bash
novel state show
```

再看目标章节的变更痕迹：

```bash
novel state-updates show <chapterId>
```

### 11.4 如何查看当前卷窗口规划是否已经生成？

```bash
novel plan volume-show <volumeId>
novel state volume-plan <volumeId>
novel review volume <volumeId>
```

### 11.5 如何在脚本或 CI 里消费卷级诊断？

用 `--json` 和 `--strict`：

```bash
novel doctor volume <volumeId> --json
novel doctor volume <volumeId> --strict
```

---

## 12. 配套阅读

- [`README.md`](README.md)
- [`src/cli.ts`](src/cli.ts)
- [`src/cli/commands/project-commands.ts`](src/cli/commands/project-commands.ts)
- [`src/cli/commands/world-commands.ts`](src/cli/commands/world-commands.ts)
- [`src/cli/commands/chapter/register.ts`](src/cli/commands/chapter/register.ts)
- [`src/cli/commands/workflow/register.ts`](src/cli/commands/workflow/register.ts)
- [`src/cli/commands/state/register.ts`](src/cli/commands/state/register.ts)
- [`src/cli/commands/doctor/register.ts`](src/cli/commands/doctor/register.ts)
- [`src/cli/commands/regression/register.ts`](src/cli/commands/regression/register.ts)
- [`src/cli/commands/snapshot/register.ts`](src/cli/commands/snapshot/register.ts)

这几处源码和本文件一起看，基本就能完整掌握当前 CLI 的全部命令与使用顺序。
