# AI 自动写小说工具 v3 设计方案

## 1. v3 总目标

`v3` 不再只是在 `v2` 的强结构化闭环之上做局部增强，而是要把系统从“章节状态闭环工具”升级成“面向长篇连续创作的叙事操作系统”。

一句话定义：

> `v2` 解决的是结构化事实可提交、可追溯，`v3` 要解决的是这些结构化事实如何进一步组织成可连续演进的叙事状态、创作质量约束与可运维工作流。

你已经明确 `v3` 采用综合版路线，但优先级顺序固定为：

1. 状态系统升级
2. 创作质量升级
3. 工作流产品化

同时，`v3` 额外纳入两项高优先级基础设施能力：

- 新增 `chapter drop` 命令，用于丢弃当前章节的 plan / draft，使章节回到可重新生成状态
- 新增统一操作日志体系，把关键工作流操作落盘到本地目录，确保操作可查、失败可追、回归可复盘

---

## 2. 为什么需要 v3

从当前 `v2` 的完成情况看，系统已经具备以下能力：

- `review -> rewrite -> approve -> trace` 主链路已打通
- 结构化闭环建议可以落库并被 `approve` 消费
- 角色 / 物品 / Hook / 记忆的主状态已开始共享统一语义
- trace、risk、rewrite validation、observation memory 等机制已经具备雏形

但目前仍然有几个明显上限：

### 2.1 状态还是“更新结果集合”，不是“叙事状态图”

当前系统能记录本章更新了谁，但还不够擅长表达：

- 某个角色正处于哪条弧线阶段
- 某个 Hook 还欠多少兑现压力
- 哪些设定属于高风险冲突点
- 哪些世界事实已经形成不可违背的长期约束
- 本章究竟完成了哪些叙事结果，留下了哪些未清债务

### 2.2 创作链路仍偏“可用”，还不够“可控”

虽然 `planning`、`generation`、`review`、`rewrite` 已有更强约束，但仍缺少：

- 场景目标级别的创作约束
- 情绪推进与人物心理因果链路控制
- 更稳定的结尾牵引标准
- 更明确的文风与表达层质量标尺
- 针对不同问题类型自动选择不同 rewrite 策略的能力

### 2.3 工作流还偏开发态，不够产品化

当前缺少几类非常实用的生产能力：

- 章节级回退与再生成入口
- 可 grep、可审计、可回放的操作日志
- doctor / regression / snapshot / batch 等运维型命令
- 旧数据整洁化与迁移工具
- 标准化回归样本与验证流程

因此，`v3` 的目标不是继续简单加功能，而是把“状态系统、创作系统、工作流系统”三层真正做成一个可持续迭代的平台。

---

## 3. v3 设计原则

### 3.1 叙事状态优先于章节文本

- 正文只是叙事表现层
- 章节结果包才是“本章发生了什么”的结构化定义
- 当前主线状态应来自章节结果包提交，而不是来自正文猜测
- planning / generation / review / rewrite / approve 必须共享统一叙事状态语义

### 3.2 章节不只产出文本，还要产出“结果包”

每一章最终应该同时产出：

- 文本结果
- 状态结果
- 债务结果
- 事实结果
- 风险结果

这意味着 `v3` 中的章节输出不再只是“正文 + review + trace”，而应升级为明确的章节结果包。

### 3.3 未完成事项必须被显式建模

长篇写作最容易崩的不是已完成事实，而是未完成事项。

因此 `v3` 必须显式建模：

- 未回收伏笔
- 未兑现承诺
- 未解决冲突
- 未完成情绪 / 人物弧线推进
- 尚待观察的事实

### 3.4 质量控制必须分层

`v3` 不再把“质量”看成一个大而空的概念，而要拆成至少三层：

1. **硬一致性层**：不能违背状态真源、长期事实、章节目标
2. **叙事执行层**：scene 是否完成任务、冲突是否推进、结尾是否留牵引
3. **语言表达层**：文风、节奏、细节、情绪、对白质量

### 3.5 所有关键操作都必须可追溯

`v3` 中的关键操作不应只在终端打印，而应形成可落盘日志，至少回答：

- 执行了什么命令
- 输入了什么参数
- 命中了哪一章 / 哪个版本
- 成功还是失败
- 产生了什么关键结果
- 若失败，失败在哪一步

### 3.6 回退能力优先做“安全回退”，不做“全链路时间旅行”

`v3` 先解决当前最常见的回退诉求：

- 丢弃当前章节的 plan / draft
- 让章节回到可重新规划、可重新写作状态

而不是一开始就做跨章节整链回滚和自动重放。

---

## 4. v3 核心范围

`v3` 建议拆成四层范围：

## P0：操作基础设施

这是 `v3` 真正开工前最值得先做的地基层。

包含：

- `chapter drop`
- 统一操作日志
- 回归快照与基础诊断命令骨架

## P1：叙事状态系统升级

这是 `v3` 的第一优先级主线。

包含：

- 章节结果包
- 人物弧线状态
- 伏笔债务与兑现压力
- 冲突 / 矛盾 / 世界事实检测
- 更强的事实分层与提交语义

## P2：创作质量系统升级

这是第二优先级主线。

包含：

- planning 阶段更强的场景任务设计
- generation 阶段更强的小说正文质量约束
- rewrite 阶段更细的分层修复策略
- review 阶段更清晰的问题分级与质量判定

## P3：工作流产品化

这是第三优先级主线。

包含：

- doctor / regression / snapshot / batch CLI
- 旧数据迁移与整洁化工具
- 标准回归样本
- 操作说明与回归文档固化

---

## 5. v3 新增关键能力一：`chapter drop`

### 5.1 目标

新增一个章节级回退命令，让用户可以丢弃当前章节的 plan 与 draft，使后续重新生成成为受支持的标准流程。

它解决的不是删除章节本身，而是：

- 当前 plan 规划得不好
- 当前 draft 写得不好
- 当前链路需要回到更早一步重跑

### 5.2 命令定位

建议新增命令：

```bash
novel chapter drop <chapterId>
```

建议支持的选项：

- `--plan-only`：只丢弃当前 plan
- `--draft-only`：只丢弃当前 draft
- `--all-current`：同时丢弃当前 plan 与当前 draft
- `--force`：允许对已进入更高阶段的章节强制执行

### 5.3 推荐默认行为

默认建议：

- 如果章节当前有 draft，则 `chapter drop` 默认删除当前 draft 引用与依赖它的 review / rewrite 当前链路引用
- 如果章节当前只有 plan，则删除当前 plan 引用
- 章节本身仍然保留
- 历史记录可以保留，不强制物理删除
- 当前版本指针要回退到空或上一个仍有效阶段

### 5.4 状态回滚规则建议

建议按下面规则实现：

1. 丢弃当前 plan 后：
   - 清空 `currentPlanVersionId`
   - 若当前没有 draft，则章节状态回到“待规划”
2. 丢弃当前 draft 后：
   - 清空 `currentVersionId`
   - 清空与该 draft 强绑定的最新 review / rewrite 链路引用
   - 若 plan 仍在，章节状态回到“可写作”
3. 已 `finalized` 章节默认不允许 drop：
   - 需要显式 `--force`
   - 且必须写入高优先级日志
4. `chapter drop` 不应默认回滚世界主状态：
   - 它针对的是“当前可再生产物”
   - 不是对历史批准章节做整链时间回退

### 5.5 安全策略

- 不物理删除章节实体
- 不默认删除历史 plan / draft / review / rewrite 记录，只解除“当前引用”
- 不自动回滚 `approve` 后已提交到主线状态的结果
- 所有 drop 操作必须写日志
- 所有 drop 操作建议先输出将被清理的对象摘要

### 5.6 验收标准

以下满足即可视为 `chapter drop` 完成：

- 可以把当前章节恢复到可重新 `plan chapter` 或 `write next` 的状态
- 不会误删章节本身
- 不会静默破坏主状态真源
- 可以从日志中查到被 drop 的版本与命令参数

---

## 6. v3 新增关键能力二：统一操作日志

### 6.1 目标

为所有关键命令增加统一本地日志落盘能力，确保：

- 操作可查
- 失败可追
- 回归可复盘
- 样本问题可复现

### 6.2 日志目录建议

建议目录：

```text
logs/
  operations/
    2026-04-03.ndjson
  errors/
    2026-04-03.ndjson
  regressions/
    2026-04-03.ndjson
```

也可以采用更简单的第一版：

```text
logs/
  operations.ndjson
  errors.ndjson
```

第一版更建议按天分文件，避免单文件无限增长。

### 6.3 日志格式建议

建议统一使用 `ndjson`，每行一条 JSON，方便：

- 终端查看
- `rg` / `jq` / `grep` 检索
- 后续导入分析工具

建议日志字段至少包括：

```ts
type OperationLog = {
  runId: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  command: string
  args: string[]
  cwd: string
  bookId?: string
  chapterId?: string
  status: 'success' | 'failed'
  durationMs?: number
  summary: string
  detail?: Record<string, unknown>
  error?: {
    name?: string
    message: string
    stack?: string
  }
}
```

### 6.4 第一批必须接入日志的操作

建议优先接入：

- `plan chapter`
- `write next`
- `review chapter`
- `chapter rewrite`
- `chapter approve`
- `chapter drop`
- `state-updates show`
- 后续的 `doctor` / `regression`

### 6.5 每类命令建议记录的额外字段

#### planning

- `planVersionId`
- `sceneCount`
- `hookPlanCount`
- `statePredictionCount`

#### generation

- `draftId`
- `draftVersionId`
- `wordCount`
- `usedPlanVersionId`

#### review

- `reviewId`
- `decision`
- `approvalRisk`
- `closureCounts`
- `issueCount`

#### rewrite

- `rewriteId`
- `strategy`
- `goals`
- `validation`

#### approve

- `chapterStatus`
- `forcedApproval`
- `finalPath`
- `stateUpdateCount`
- `memoryUpdateCount`
- `hookUpdateCount`

#### chapter drop

- `droppedPlanVersionId`
- `droppedDraftVersionId`
- `droppedReviewId`
- `droppedRewriteId`
- `dropMode`

### 6.6 日志设计原则

- 命令执行失败也要写日志
- 失败日志与成功日志字段结构尽量一致
- 日志写入不能影响主事务成功与否
- 日志应尽量放在业务边界层统一调用，而不是散落在所有 service 内

### 6.7 验收标准

以下满足即可视为统一操作日志第一版完成：

- 所有主链路命令都有本地日志
- 任意一次失败都能从日志定位到命令、章节、阶段和错误摘要
- 回归执行可从日志还原基本步骤

---

## 7. v3 第一优先级：叙事状态系统升级

这是 `v3` 最核心、最值得优先开工的部分。

### 7.1 从“状态更新”升级为“章节结果包”

建议引入新的章节结果包概念，例如：

```ts
type ChapterOutcome = {
  chapterId: string
  sourceReviewId?: string
  sourceRewriteId?: string
  decision: 'accepted' | 'accepted-with-risk' | 'rejected'
  resolvedFacts: string[]
  observationFacts: string[]
  contradictions: NarrativeContradiction[]
  characterArcProgress: CharacterArcProgress[]
  hookDebtUpdates: HookDebtUpdate[]
  stateClosures: ClosureSuggestions
  narrativeDebts: NarrativeDebt[]
  createdAt: string
}
```

这个结果包的意义是：

- review 不再只给问题
- approve 不再只提状态更新
- 系统开始真正知道“这一章叙事上完成了什么、欠下了什么、风险在哪里”

### 7.2 引入人物弧线状态

当前角色状态主要记录位置和状态备注，`v3` 建议显式新增人物弧线建模，例如：

- 当前弧线名称
- 当前弧线阶段
- 本章推进结果
- 下章压力点

这样 planning 与 rewrite 才能真的围绕“人物成长与关系推进”工作，而不只是围绕事件顺序工作。

### 7.3 引入伏笔债务与兑现压力

当前 Hook 状态是：

- open
- foreshadowed
- payoff-planned
- resolved

这对追踪状态已经有帮助，但对 planning 还不够强。

`v3` 建议增加：

- Hook 兑现压力值
- 最晚应推进窗口
- 最近一次推进章节
- 若继续不推进的风险等级

这样 planning 才能知道哪些伏笔必须优先处理，而不是平均对待所有 Hook。

### 7.4 引入叙事矛盾与世界冲突模型

建议新增“矛盾”与“风险”建模：

- 事实冲突
- 人物动机冲突
- 时间线冲突
- 场景逻辑跳跃
- 世界规则冲突

review 可以输出这些结构化冲突，approve 只提交被接受的结果，不提交被拒绝的脏状态。

### 7.5 引入待观察事实与未完成承诺

`v2` 已有 observation memory 雏形，`v3` 应该进一步升级为：

- 待观察事实池
- 未完成承诺池
- 下一章必须承接事项

这能明显减少“上一章提了悬念，后两章完全忘了”的问题。

### 7.6 第一阶段交付重点

`v3` 状态系统第一阶段建议只先做：

- `ChapterOutcome` 类型与持久化
- `NarrativeDebt` 类型与持久化
- `NarrativeContradiction` 类型与持久化
- `CharacterArcProgress` 类型与持久化
- `approve` 开始消费章节结果包，而不是只消费 closureSuggestions

---

## 8. v3 第二优先级：创作质量系统升级

### 8.1 planning：从场景卡升级为场景任务包

当前 `sceneCards` 已能描述场景目的和 beats，`v3` 建议升级为更强的场景任务包，例如增加：

- 场景情绪目标
- 场景冲突职责
- 场景必须完成的信息转移
- 本场景不可违反的事实
- 本场景结尾转折要求

### 8.2 generation：从“能写出来”升级为“按层控制质量”

`v3` generation 需要显式消费：

- 场景目标
- 情绪曲线
- 角色弧线推进目标
- Hook 压力与结尾牵引要求
- 文风约束
- 不得破坏的事实约束

建议把 generation 输出目标拆成三层：

1. 必须满足状态真源
2. 必须完成 scene 任务
3. 必须满足小说语言质量要求

### 8.3 review：从“问题报告”升级为“质量控制器”

`v3` review 除了继续产出 closureSuggestions 外，还应新增：

- 硬错误
- 软问题
- 风格问题
- 叙事问题
- 人物弧线推进问题
- 结尾牵引不足问题

并给出 rewrite 策略建议，而不只是修订建议。

### 8.4 rewrite：从“建议修文”升级为“策略型重写”

建议把 rewrite 策略细化为：

- 一致性修复
- 节奏修复
- 情绪增强
- 对话增强
- 结尾牵引增强
- 长度修正
- 风格统一

不同策略读取不同质量标尺，而不是都走同一种 prompt 逻辑。

### 8.5 创作质量的验收口径

以下满足可视为这一层达到 `v3` 要求：

- planning 能稳定产出更强 scene 任务定义
- generation 正文明显减少模板化与摘要化倾向
- review 能区分状态问题与创作质量问题
- rewrite 能按问题类型选择不同修复路径
- 结尾牵引与人物推进明显增强

---

## 9. v3 第三优先级：工作流产品化

### 9.1 新增 doctor 命令

建议新增：

```bash
novel doctor
novel doctor chapter <chapterId>
```

用于检查：

- 当前章节链路完整性
- plan / draft / review / rewrite / output 是否断链
- 当前状态是否存在明显冲突
- 关键日志是否缺失

### 9.2 新增 regression 命令

建议新增：

```bash
novel regression run <caseName>
```

用于标准样本回放：

- 复制样本库
- 跑一轮固定命令链
- 收集结果摘要
- 写入 regression 日志

### 9.3 新增 snapshot 命令

建议新增：

```bash
novel snapshot state
novel snapshot chapter <chapterId>
```

用于：

- 固化回归前后结果
- 对比结构化状态变化
- 配合回归与排障

### 9.4 新增 batch 命令

建议新增：

- 批量 review
- 批量 show
- 批量导出状态摘要

第一版不一定全部实现，但建议预留产品化方向。

### 9.5 数据迁移与整洁化

建议纳入：

- 旧数据兼容迁平脚本
- 历史 decision 值整洁化
- 老 trace 与新 trace 的格式统一
- 历史 review 脏结构清洗工具

### 9.6 文档与标准流程固化

最终建议把真实样本回归、`chapter drop`、日志排查、doctor 使用说明补充到：

- `COMMAND_GUIDE.md`
- `plans/` 下的回归计划文档

---

## 10. v3 数据与模块影响面

### 10.1 重点新增或强化的类型层

重点文件：

- `src/shared/types/domain.ts`

建议新增：

- `ChapterOutcome`
- `NarrativeDebt`
- `NarrativeContradiction`
- `CharacterArcProgress`
- `SceneGoal`
- `QualityIssue`
- `OperationLog`
- `DropChapterResult`

### 10.2 重点新增或强化的数据库 / 仓储层

重点文件：

- `src/infra/db/schema.ts`
- `src/infra/repository/*`

建议新增表：

- `chapter_outcomes`
- `chapter_narrative_debts`
- `chapter_contradictions`
- `operation_logs`

若暂不落数据库，也至少要先完成本地文件日志体系。

### 10.3 重点新增或强化的核心模块

重点文件：

- `src/core/review/service.ts`
- `src/core/rewrite/service.ts`
- `src/core/approve/service.ts`
- `src/core/planning/service.ts`
- `src/core/generation/service.ts`
- `src/core/context/planning-context-builder.ts`
- `src/core/context/writing-context-builder.ts`

### 10.4 重点新增或强化的 CLI 层

重点文件：

- `src/cli/commands/chapter-commands.ts`
- `src/cli/commands/workflow-commands.ts`
- `src/cli/commands/state-commands.ts`
- 新增 `doctor` / `regression` / `snapshot` 命令文件

---

## 11. v3 里程碑拆分

## M0：操作基础设施先行

交付：

- `chapter drop`
- 统一操作日志
- 基础回归快照能力

验收：

- 当前章节可安全回到可再生成状态
- 关键命令都有本地日志
- 回归执行过程可落盘复盘

---

## M1：章节结果包与状态图升级

交付：

- `ChapterOutcome`
- `NarrativeDebt`
- `NarrativeContradiction`
- 基础持久化与展示

验收：

- 章节不只输出文本，还输出结构化结果包
- 系统能知道本章完成了什么、欠下了什么、冲突在哪里

---

## M2：人物弧线与伏笔压力进入 planning / review / approve

交付：

- 角色弧线推进模型
- Hook 兑现压力模型
- planning / review / approve 消费这些状态

验收：

- planning 会优先处理高压力 Hook
- review 能指出弧线推进缺失
- approve 能沉淀弧线与债务结果

---

## M3：创作质量分层控制

交付：

- scene 任务包升级
- generation 质量约束升级
- review 分层问题输出
- rewrite 策略分层

验收：

- 生成正文质量显著更稳
- review 与 rewrite 的控制力明显增强

---

## M4：工作流产品化命令

交付：

- `doctor`
- `regression`
- `snapshot`
- 批量工作流骨架

验收：

- 常见问题可命令化排查
- 回归验证可标准化执行

---

## M5：迁移、整洁化与文档固化

交付：

- 旧数据整洁化工具
- 兼容层迁平策略
- 标准回归样本
- 文档固化

验收：

- 新旧数据表现统一
- 团队可按文档复现关键流程

---

## 12. 推荐实施顺序

建议严格按下面顺序推进：

1. `chapter drop`
2. 统一操作日志
3. `ChapterOutcome` 与 `NarrativeDebt` 基础类型 / 持久化
4. review 产出章节结果包雏形
5. approve 消费章节结果包雏形
6. Hook 压力与人物弧线进入 planning
7. generation / rewrite / review 的质量分层升级
8. doctor / regression / snapshot
9. 迁移、整洁化、文档固化

原因：

- 没有 `drop` 和日志，后续回归和排障成本太高
- 没有章节结果包，状态系统升级会继续停留在“更新集合”层
- 没有更强的状态语义，创作质量系统很难真正稳定
- 工作流产品化应该建立在状态系统与质量系统基本稳定之后

---

## 13. v3 验收标准

以下全部满足，可视为 `v3` 达到目标：

1. 系统能用章节结果包表达“本章完成了什么、留下了什么、风险在哪里”
2. 人物弧线、Hook 债务、待观察事实、叙事矛盾进入统一状态体系
3. planning 能基于状态压力而不是平均生成事件大纲
4. generation / review / rewrite 能分层处理一致性、叙事执行、语言质量三类问题
5. `chapter drop` 能安全回退当前章节的 plan / draft
6. 所有关键命令都有本地日志，失败可追、回归可复盘
7. doctor / regression / snapshot 能支撑日常排障与验收
8. 标准样本回归流程与文档固化完成

---

## 14. 一句话总结

`v3` 的核心不是简单地“让模型写得更好”，而是：

> 让系统把章节写作从一次次独立的文本生成，升级成一个可回退、可追溯、可积累叙事状态、可持续优化质量的长篇创作平台。
