# AI 自动写小说工具 v3 模块级任务拆解

## 1. 这份文档的用途

- 这份文档是 [`plans/v3-integrated-plan.md`](plans/v3-integrated-plan.md:1) 的执行层拆解版本
- 目标不是再解释 `v3` 的总体方向，而是回答“接下来具体先写什么文件、做什么模块、按什么顺序推进”
- 适合直接拿来排开发任务，也适合在实现时作为阶段验收清单

## 2. v3 的总执行策略

`v3` 的核心不是继续追加零散功能，而是把系统升级成“可回退、可追溯、可持续积累叙事状态”的长篇创作平台。

你已经明确 `v3` 的优先级顺序为：

1. 先做状态系统升级
2. 再做创作质量升级
3. 最后做工作流产品化

但在真正进入这三层之前，必须先补两个基础设施入口：

1. `chapter drop`
2. 统一操作日志

因此 `v3` 的推荐执行顺序必须是：

1. 先补可安全回退的章节操作能力
2. 再补统一操作日志与回归基础设施
3. 再建立章节结果包、叙事债务、冲突模型等状态真源
4. 再让 planning / generation / review / rewrite / approve 共享这套新的叙事状态语义
5. 最后再补 doctor / regression / snapshot / batch 这类产品化工作流

如果反过来做，会出现：

- 状态模型设计了，但缺少回退入口，调试成本很高
- 创作质量逻辑增强了，但没有统一日志，很难复盘问题来源
- doctor / regression 做了，但底层还没有稳定的章节结果包和统一状态图
- `chapter drop` 没有先做，后续章节链路迭代和样本回放会持续受阻

## 3. v3 模块总览

`v3` 建议优先新增或强化的模块：

- `src/shared/types/domain.ts`
- `src/infra/db/schema.ts`
- `src/infra/repository/chapter-repository.ts`
- `src/infra/repository/chapter-plan-repository.ts`
- `src/infra/repository/chapter-draft-repository.ts`
- `src/infra/repository/chapter-review-repository.ts`
- `src/infra/repository/chapter-rewrite-repository.ts`
- `src/infra/repository/chapter-output-repository.ts`
- `src/infra/repository/operation-log-repository.ts`（如决定日志落数据库）
- `src/core/review/service.ts`
- `src/core/rewrite/service.ts`
- `src/core/approve/service.ts`
- `src/core/planning/service.ts`
- `src/core/generation/service.ts`
- `src/core/context/planning-context-builder.ts`
- `src/core/context/writing-context-builder.ts`
- `src/core/chapter-drop/service.ts`（建议新增）
- `src/cli/commands/chapter-commands.ts`
- `src/cli/commands/workflow-commands.ts`
- `src/cli/commands/state-commands.ts`
- `src/cli/commands/doctor-commands.ts`（建议新增）
- `src/cli/commands/regression-commands.ts`（建议新增）
- `src/cli/commands/snapshot-commands.ts`（建议新增）
- `src/shared/utils/project-paths.ts`
- `src/shared/utils/logging.ts`（建议新增）

## 4. 里程碑拆解

## M0：`chapter drop` 与统一日志基础设施

### M0 目标

先解决两件最影响后续迭代效率的事：

- 章节当前 plan / draft 可以安全丢弃并重来
- 所有关键操作可以本地落盘并追溯

### M0 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

新增或补强：

- `DropChapterMode`
- `DropChapterRequest`
- `DropChapterResult`
- `OperationLog`
- `OperationLogLevel`
- `OperationLogStatus`

建议字段至少包括：

- `chapterId`
- `dropMode`
- `droppedPlanVersionId?`
- `droppedDraftVersionId?`
- `droppedReviewId?`
- `droppedRewriteId?`
- `previousChapterStatus`
- `nextChapterStatus`
- `timestamp`

完成定义：

- `chapter drop` 和统一日志不再只是 CLI 行为，而是有明确契约类型
- 后续 service、CLI、日志层共享统一结构

#### B. [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:1)

补强：

- 日志目录解析
- 操作日志文件路径生成
- 按日分文件的日志路径规则

建议新增能力：

- `resolveOperationLogDir(rootDir)`
- `resolveOperationLogFile(rootDir, date)`
- `ensureLogsDir(rootDir)`

完成定义：

- 日志落盘路径不散落在各命令里硬编码
- 后续 `doctor` / `regression` / `snapshot` 可复用同一套路径工具

#### C. `src/shared/utils/logging.ts`

建议新建。

交付件：

- `appendOperationLog(entry)`
- `createRunId()`
- `createCommandLogger(commandName)`
- 对失败和成功统一封装

完成定义：

- CLI 主命令都能用同一套日志写入工具
- 日志格式统一为 `ndjson`

#### D. [`src/infra/db/schema.ts`](src/infra/db/schema.ts:1)

按实现策略二选一：

1. 第一版只落本地文件，不新增数据库日志表
2. 若要补数据库辅助索引，则增加：
   - `operation_logs`

若引入 `operation_logs`，建议字段至少包括：

- `id`
- `run_id`
- `command`
- `book_id`
- `chapter_id`
- `status`
- `summary`
- `detail_json`
- `created_at`

完成定义：

- 日志体系的数据模型有明确承载位置
- 即便首版不进数据库，也要在文档中固定保留数据库扩展位

#### E. `src/core/chapter-drop/service.ts`

建议新建。

交付件：

- `dropChapter(chapterId, options)`
- `dropPlanOnly()`
- `dropDraftOnly()`
- `dropCurrentChain()`

关键职责：

- 读取章节当前 plan / draft / review / rewrite / output 关联
- 根据 `dropMode` 解除当前引用
- 重新计算章节状态
- 输出 `DropChapterResult`
- 写操作日志

完成定义：

- 章节可以回到“待规划”或“待写作”
- 不误删章节实体
- 不默认回滚已提交的主状态

#### F. [`src/infra/repository/chapter-repository.ts`](src/infra/repository/chapter-repository.ts:1)

补强：

- 支持按 `chapterId` 更新：
  - `status`
  - `currentPlanVersionId`
  - `currentVersionId`
  - `approvedAt`
  - `finalPath`
  - `updatedAt`

完成定义：

- `chapter drop` 可以只通过 repository 改变章节当前指针，不直接散写 SQL

#### G. [`src/infra/repository/chapter-plan-repository.ts`](src/infra/repository/chapter-plan-repository.ts:1)

补强：

- `getLatestByChapterId`
- `getByVersionId`
- 如有需要，新增“列出某章全部 plan 版本”接口

完成定义：

- `chapter drop` 能精确识别当前 plan 与历史 plan

#### H. [`src/infra/repository/chapter-draft-repository.ts`](src/infra/repository/chapter-draft-repository.ts:1)

补强：

- `getLatestByChapterId`
- `listByChapterId`
- 如有需要，新增版本级查询

完成定义：

- `chapter drop` 能安全识别当前 draft 与历史 draft

#### I. [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts:1)

补强：

- `getLatestByChapterId`
- `listByChapterId`
- 如有需要，补“按 draftId / rewriteId 查 review”能力

完成定义：

- `chapter drop` 可以明确哪些 review 受当前 draft 链路影响

#### J. [`src/infra/repository/chapter-rewrite-repository.ts`](src/infra/repository/chapter-rewrite-repository.ts:1)

补强：

- `getLatestByChapterId`
- `listByChapterId`
- 如有需要，补“按 reviewId 查 rewrite”能力

完成定义：

- `chapter drop` 可以明确识别当前 rewrite 依赖链

#### K. [`src/cli/commands/chapter-commands.ts`](src/cli/commands/chapter-commands.ts:32)

补强：

- 新增 `chapter drop <chapterId>`
- 支持：
  - `--plan-only`
  - `--draft-only`
  - `--all-current`
  - `--force`
- 打印 drop 结果摘要
- 写本地操作日志

完成定义：

- 用户可以命令化丢弃当前章节 plan / draft
- 输出结果可读且可追溯

#### L. [`src/cli.ts`](src/cli.ts:1)

补强：

- 注册 `chapter drop`
- 预留后续 doctor / regression / snapshot 命令入口

### M0 验收

- 可以通过 `chapter drop` 把当前章节恢复到可重新生成状态
- drop 不会默认破坏已批准章节的主线状态
- 所有主链路命令都能本地写日志
- 任意一次 drop、review、rewrite、approve 都能在日志里查到结果

---

## M1：章节结果包与叙事状态图升级

### M1 目标

先把章节从“文本产物 + 更新记录”升级为“章节结果包 + 叙事状态结果”。

重点回答：

- 本章到底确认了哪些事实
- 本章留下了哪些未完成事项
- 本章引入了哪些风险和矛盾

### M1 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

新增或补强：

- `ChapterOutcome`
- `NarrativeDebt`
- `NarrativeContradiction`
- `CharacterArcProgress`
- `HookDebtUpdate`
- `ResolvedFact`
- `ObservationFact`

建议字段至少包括：

- `chapterId`
- `sourceReviewId?`
- `sourceRewriteId?`
- `decision`
- `resolvedFacts`
- `observationFacts`
- `contradictions`
- `narrativeDebts`
- `characterArcProgress`
- `createdAt`

完成定义：

- 章节结果不再只是 review 问题 + approve trace
- 开始有统一“本章结果包”模型

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts:1)

新增：

- `chapter_outcomes`
- `chapter_narrative_debts`
- `chapter_contradictions`
- 如有需要，增加 `character_arc_progress_updates`

完成定义：

- 章节结果包可以落库，不只存在内存流程里

#### C. `src/infra/repository/chapter-outcome-repository.ts`

建议新建。

交付件：

- `create`
- `getLatestByChapterId`
- `listByChapterId`

完成定义：

- 任意章节的最新结果包都可读取

#### D. `src/infra/repository/narrative-debt-repository.ts`

建议新建。

交付件：

- `createBatch`
- `listOpenByBookId`
- `listByChapterId`
- `resolveByIds`

完成定义：

- 未完成承诺、未回收伏笔、待承接事项等可以结构化追踪

#### E. `src/infra/repository/chapter-contradiction-repository.ts`

建议新建。

交付件：

- `createBatch`
- `listByChapterId`
- `listOpenByBookId`

完成定义：

- 世界冲突、叙事冲突、事实冲突可单独追溯

#### F. [`src/core/review/service.ts`](src/core/review/service.ts:1)

补强：

- 在现有 `ReviewReport` 基础上增加章节结果包候选生成
- 输出：
  - 已确认事实
  - 待观察事实
  - 本章引入的未完成叙事债务
  - 明确冲突项

完成定义：

- review 不再只是问题控制器，也开始成为章节结果包生成入口

#### G. [`src/core/approve/service.ts`](src/core/approve/service.ts:52)

补强：

- `approve` 在提交角色 / 物品 / Hook / memory 的同时，提交 `ChapterOutcome`
- 将本章确认事实与未完成债务一起写入结构化结果层

完成定义：

- `approve` 正式成为“章节结果包提交入口”

#### H. [`src/cli/commands/chapter-commands.ts`](src/cli/commands/chapter-commands.ts:61)

补强：

- `chapter show` 增加最新 outcome 摘要
- 展示：
  - debt 数量
  - contradiction 数量
  - confirmed facts 数量

### M1 验收

- 每章完成后可以读取最新章节结果包
- 系统不只知道“状态怎么变”，还知道“本章留下了什么待处理事项”
- `chapter show` 可以看到结果包摘要

---

## M2：人物弧线与 Hook 债务压力进入状态系统

### M2 目标

让系统从“记录当前状态”升级为“理解当前叙事压力”。

重点包括：

- 角色弧线推进状态
- Hook 兑现压力与逾期风险

### M2 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

新增或补强：

- `CharacterArc`
- `CharacterArcStage`
- `CharacterArcProgress`
- `HookPressure`
- `NarrativePressure`

完成定义：

- 人物弧线和 Hook 压力成为明确数据结构，不再只是 prompt 文本描述

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts:1)

新增：

- `character_arc_current_state`
- `hook_pressure_current`

建议字段至少包括：

- 当前阶段
- 最近推进章节
- 压力分值
- 风险等级
- 下一次建议处理窗口

#### C. `src/infra/repository/character-arc-repository.ts`

建议新建。

交付件：

- `getByCharacterId`
- `listByBookId`
- `upsert`

#### D. `src/infra/repository/hook-pressure-repository.ts`

建议新建。

交付件：

- `getByHookId`
- `listActiveByBookId`
- `upsert`

#### E. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts:12)

补强：

- planning 时注入：
  - 角色弧线当前阶段
  - 高压力 Hook
  - 未完成叙事债务

完成定义：

- planning 能优先看到“必须处理什么”，而不是平均设计事件

#### F. [`src/core/planning/service.ts`](src/core/planning/service.ts:19)

补强：

- 在 `ChapterPlan` 中增加：
  - 高压力 Hook 处理建议
  - 人物弧线推进目标
  - 未完成承诺承接目标

完成定义：

- planning 能根据叙事压力主动做任务分配

#### G. [`src/core/review/service.ts`](src/core/review/service.ts:1)

补强：

- 检查本章是否推进了应推进的高压力 Hook
- 检查本章是否承接了必须承接的人物弧线变化

#### H. [`src/core/approve/service.ts`](src/core/approve/service.ts:52)

补强：

- 根据本章 outcome 更新角色弧线当前阶段
- 更新 Hook 压力与债务状态

### M2 验收

- planning 能明确看到高压力 Hook 与角色弧线阶段
- review 能指出弧线推进缺失或高压力 Hook 被忽略
- approve 后这些状态可以成为下一章 planning 的真实输入

---

## M3：planning 升级为场景任务系统

### M3 目标

让 planning 从“事件大纲生成器”升级为“场景任务分配器”。

### M3 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

新增或补强：

- `SceneGoal`
- `SceneConstraint`
- `SceneEmotionalTarget`
- `SceneOutcomeChecklist`

建议新增到 `ChapterPlan`：

- `sceneGoals`
- `endingDrive`
- `mustResolveDebts`
- `mustAdvanceHooks`
- `mustPreserveFacts`

#### B. [`src/core/planning/service.ts`](src/core/planning/service.ts:19)

补强：

- 让 planning 产出更强的 scene task 包
- 区分：
  - 场景要推进什么冲突
  - 场景要释放什么信息
  - 场景要完成什么情绪变化
  - 场景不能破坏哪些事实

#### C. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts:12)

补强：

- 注入人物弧线状态、Hook 压力、未完成债务、长期事实禁区

#### D. [`src/infra/repository/chapter-plan-repository.ts`](src/infra/repository/chapter-plan-repository.ts:1)

补强：

- 持久化新的 `sceneGoals`、`endingDrive`、`mustResolveDebts` 等字段

### M3 验收

- `ChapterPlan` 明确表达 scene 任务，不只是平铺事件
- planning 能把状态压力转译成章节任务

---

## M4：generation 升级为受控创作链路

### M4 目标

让 generation 不只是“生成一章”，而是在明确任务、情绪、风格和约束下稳定生成正文。

### M4 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

补强：

- `WritingQualityContract`
- `ToneConstraint`
- `NarrativeVoiceConstraint`
- `EmotionalCurve`

#### B. [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts:6)

补强：

- 注入：
  - 场景任务
  - 人物弧线推进目标
  - 本章关键债务
  - 风格约束
  - 高压力 Hook

#### C. [`src/core/generation/service.ts`](src/core/generation/service.ts:8)

补强：

- generation prompt 结构升级
- 将正文质量约束与状态一致性约束分层组织
- 强化结尾牵引与场景职责

#### D. [`src/core/review/service.ts`](src/core/review/service.ts:1)

补强：

- 新增对 scene 执行度、结尾牵引、情绪推进的审查

### M4 验收

- generation 输出的正文更明显围绕 scene task 展开
- review 能指出 scene 未完成和结尾牵引不足问题

---

## M5：review 分层质量控制

### M5 目标

把 review 从“统一问题列表”升级为“分层质量控制器”。

### M5 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

新增或补强：

- `MustFixIssue`
- `NarrativeQualityIssue`
- `LanguageQualityIssue`
- `RewriteStrategySuggestion`

#### B. [`src/core/review/service.ts`](src/core/review/service.ts:1)

补强：

- 输出问题分层：
  - 硬一致性问题
  - 叙事执行问题
  - 语言表达问题
- 输出 rewrite 策略建议

#### C. [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts:1)

补强：

- 持久化新的分层问题结构

#### D. [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts:163)

补强：

- `review show` 展示分层问题与 rewrite strategy suggestion

### M5 验收

- review 能把问题区分成“必须修”和“可优化”
- rewrite 不再只能吃一串平面建议

---

## M6：rewrite 升级为策略型重写

### M6 目标

让 rewrite 根据问题类型选择不同修复方式，而不是始终只做同构重写。

### M6 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)

补强：

- `RewriteStrategyProfile`
- `RewriteQualityTarget`

#### B. [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:16)

补强：

- 根据 review 分层问题自动映射策略
- 支持：
  - consistency-first
  - pacing-first
  - ending-drive-first
  - dialogue-enhance
  - emotion-enhance
  - length-correction

#### C. [`src/infra/repository/chapter-rewrite-repository.ts`](src/infra/repository/chapter-rewrite-repository.ts:19)

补强：

- 持久化更强的 validation 和 strategy profile

### M6 验收

- rewrite 可以根据问题类型切换策略
- validation 能更清晰显示本次重写修复了什么

---

## M7：doctor / regression / snapshot / batch CLI

### M7 目标

把工作流产品化能力补起来，让排障和回归不再依赖临时手工命令。

### M7 模块任务

#### A. `src/cli/commands/doctor-commands.ts`

建议新建。

交付件：

- `doctor`
- `doctor chapter <chapterId>`

检查内容建议包括：

- 章节链路完整性
- plan / draft / review / rewrite / output 是否断链
- 状态数据是否明显冲突
- 日志是否存在

#### B. `src/cli/commands/regression-commands.ts`

建议新建。

交付件：

- `regression run <case>`
- `regression list`

#### C. `src/cli/commands/snapshot-commands.ts`

建议新建。

交付件：

- `snapshot state`
- `snapshot chapter <chapterId>`

#### D. 可选：`src/cli/commands/batch-commands.ts`

建议后置。

交付件：

- 批量 review
- 批量导出摘要
- 批量 show

### M7 验收

- 常见排障与回归路径可命令化执行
- 回归结果可以标准落盘

---

## M8：迁移、整洁化、样本与文档固化

### M8 目标

让 `v3` 不只可开发，还可稳定维护。

### M8 模块任务

#### A. 数据迁移与整洁化

涉及：

- 历史 `review.decision` 兼容值整洁化
- 老 review 脏结构清洗
- 老 trace 格式统一

#### B. 回归样本体系

建议补：

- 强命中 hook 样本
- 强命中角色 / 物品状态样本
- 失败样本
- drop 回退样本

#### C. [`COMMAND_GUIDE.md`](COMMAND_GUIDE.md:1)

补强：

- `chapter drop`
- 日志目录说明
- doctor / regression / snapshot 使用方式
- 标准回归路径

#### D. `plans/` 文档固化

补强：

- `v3` 回归计划
- `v3` 数据迁移说明
- `v3` 日志字段说明

### M8 验收

- 新旧数据表现更统一
- 样本回归和常见排障流程有文档可依
- 新人可以按文档复现关键链路

## 5. 每阶段执行顺序

### 第一阶段：先打 M0

顺序：

1. `domain.ts` 增加 `DropChapterResult` 和 `OperationLog`
2. `project-paths.ts` 增加日志目录解析
3. 新建 `logging.ts`
4. 新建 `chapter-drop/service.ts`
5. `chapter repository` / `plan repository` / `draft repository` / `review repository` / `rewrite repository` 补当前链路读取能力
6. `chapter-commands.ts` 新增 `chapter drop`
7. 主链路命令接入日志写入

### 第二阶段：做 M1

顺序：

1. 定义 `ChapterOutcome` / `NarrativeDebt` / `NarrativeContradiction`
2. schema 新增相关表
3. 新建 outcome / debt / contradiction repositories
4. `ReviewService` 生成章节结果包候选
5. `ApproveService` 提交章节结果包
6. `chapter show` 展示结果包摘要

### 第三阶段：做 M2

顺序：

1. 角色弧线类型与表
2. Hook 压力类型与表
3. planning context 注入弧线 / 压力 / 债务
4. planning service 消费这些状态
5. review / approve 接入这些状态提交与检查

### 第四阶段：做 M3 + M4

顺序：

1. scene task 包升级
2. planning 输出升级
3. writing context 注入新约束
4. generation prompt 升级
5. review 增加 scene / 情绪 / 结尾执行检查

### 第五阶段：做 M5 + M6

顺序：

1. review 分层问题类型
2. review 输出 rewrite strategy suggestion
3. rewrite strategy profile
4. rewrite service 策略化执行
5. rewrite validation 升级

### 第六阶段：做 M7 + M8

顺序：

1. doctor commands
2. regression commands
3. snapshot commands
4. 旧数据整洁化脚本
5. 回归样本与文档固化

## 6. 推荐你下一步直接开工的任务

如果下一轮进入 coding，我建议从下面 10 个任务开始：

1. 在 [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1) 增加 `DropChapterRequest`、`DropChapterResult`、`OperationLog`
2. 在 [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:1) 增加日志目录与文件路径解析
3. 新建 `src/shared/utils/logging.ts`
4. 新建 `src/core/chapter-drop/service.ts`
5. 补强 [`src/infra/repository/chapter-repository.ts`](src/infra/repository/chapter-repository.ts:1)
6. 补强 [`src/infra/repository/chapter-plan-repository.ts`](src/infra/repository/chapter-plan-repository.ts:1)
7. 补强 [`src/infra/repository/chapter-draft-repository.ts`](src/infra/repository/chapter-draft-repository.ts:1)
8. 补强 [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts:1)
9. 补强 [`src/infra/repository/chapter-rewrite-repository.ts`](src/infra/repository/chapter-rewrite-repository.ts:1)
10. 在 [`src/cli/commands/chapter-commands.ts`](src/cli/commands/chapter-commands.ts:32) 增加 `chapter drop`

## 7. 一句话总纲

`v3` 的开发顺序不是“先把所有高级状态和创作能力都铺开”，而是：

> 先让章节能安全回退、操作可追溯，再让每一章产出结构化叙事结果，最后让 planning / generation / review / rewrite / approve 在这套更强的叙事状态系统上协同工作。
