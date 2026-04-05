# v4 卷级回归样本清单

## 目标

固定一组面向 `v4` 多章导演能力的最小回归样本，覆盖：

- 多章连续规划
- mission 承接与主线推进
- 终局准备度
- 卷级 CLI / doctor / snapshot / regression 验收口径

这些样本先服务于命令验收与人工回归，后续可逐步接入真实执行器。

## 样本列表

### `volume-plan-smoke`
- 目的：验证卷级滚动窗口计划可以生成、落库、展示
- 前置条件：
  - 目标章节已存在且可由 [`PlanningContextBuilder.build()`](src/core/context/planning-context-builder.ts:36) 成功构建上下文
  - 目标章节所在卷已存在
  - 项目已有基础 outline / chapter / volume 数据
- 建议命令：
  - `novel plan volume-window <chapterId>`
  - `novel plan volume-show <volumeId>`
  - `novel state volume-plan <volumeId>`
- 核心检查点：
  - 生成最新 `VolumePlan`
  - `rollingWindow` 不为空
  - `chapterMissions` 数量大于 `0`
  - `threadIds` 与 `chapterMissions[].threadId` 存在对应关系
- 失败后重点查看：
  - [`src/core/planning/service.ts`](src/core/planning/service.ts:62)
  - [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts:36)
  - [`src/infra/repository/volume-plan-repository.ts`](src/infra/repository/volume-plan-repository.ts:21)
- 建议保留 artifact：
  - `plan volume-show <volumeId>` 输出
  - `state volume-plan <volumeId>` 输出
  - 对应 `logs/operations/` 日志片段

### `mission-carry-smoke`
- 目的：验证当前章 mission 可以被查看，并能进入 generation / rewrite / review 链路
- 前置条件：
  - 目标章节已存在
  - 所在卷已有最新 `VolumePlan`
  - `VolumePlan.chapterMissions` 中包含该章节 mission
- 建议命令：
  - `novel plan chapter <chapterId>`
  - `novel plan mission-show <chapterId>`
  - `novel write next <chapterId>`
  - `novel review chapter <chapterId>`
- 核心检查点：
  - `plan mission-show` 能读取 mission
  - generation 输出不再只围绕 scene task，也体现 mission / thread / carry task
  - review 输出保留 mission progress / thread issues
- 失败后重点查看：
  - [`src/cli/commands/workflow/plan-mission-show.ts`](src/cli/commands/workflow/plan-mission-show.ts:8)
  - [`src/core/generation/service.ts`](src/core/generation/service.ts:68)
  - [`src/core/review/service.ts`](src/core/review/service.ts:413)
- 建议保留 artifact：
  - `plan mission-show <chapterId>` 输出
  - `write next <chapterId>` 结果
  - `review chapter <chapterId>` 输出

### `thread-progression-smoke`
- 目的：验证线程焦点、thread progress、volume review / state threads 可以形成闭环观察
- 前置条件：
  - 目标卷存在活跃 `StoryThread`
  - 至少有部分章节已经进入 review / approve 链路
- 建议命令：
  - `novel state threads <volumeId>`
  - `novel review volume <volumeId>`
  - `novel doctor volume <volumeId>`
- 核心检查点：
  - `state threads` 能列出活跃线程和 recent progress
  - `review volume` 能聚合卷计划 / threads / ending readiness / chapter reviews
  - `doctor volume` 能暴露 stalled / neglected / mission chain 风险信号
- 失败后重点查看：
  - [`src/infra/repository/story-thread-progress-repository.ts`](src/infra/repository/story-thread-progress-repository.ts:15)
  - [`src/cli/commands/state/services.ts`](src/cli/commands/state/services.ts:257)
  - [`src/cli/commands/workflow-services.ts`](src/cli/commands/workflow-services.ts:67)
- 建议保留 artifact：
  - `state threads <volumeId>` 输出
  - `review volume <volumeId>` 输出
  - `doctor volume <volumeId>` 输出

### `ending-readiness-smoke`
- 目的：验证终局准备度可以被 state / doctor / snapshot / regression 侧查看
- 前置条件：
  - 项目中已有 `EndingReadiness`
  - 当前目标卷或目标书已进入中后段并产生 closure gap / payoff requirement
- 建议命令：
  - `novel state ending`
  - `novel snapshot volume <volumeId>`
  - `novel regression volume <volumeId>`
- 核心检查点：
  - `state ending` 能显示当前 readiness / closure 状态
  - `snapshot volume` 包含 ending readiness
  - `regression volume` 能把 ending-readiness case 运行并输出结构化结果
- 失败后重点查看：
  - [`src/infra/repository/ending-readiness-repository.ts`](src/infra/repository/ending-readiness-repository.ts:18)
  - [`src/core/approve/service.ts`](src/core/approve/service.ts:670)
  - [`src/cli/commands/state/ending.ts`](src/cli/commands/state/ending.ts:7)
- 建议保留 artifact：
  - `state ending` 输出
  - `snapshot volume <volumeId>` 输出
  - `regression volume <volumeId>` 输出

### `volume-doctor-smoke`
- 目的：验证卷级 doctor 能暴露主线停滞、回收缺口、mission 断链、群像风险等信号
- 前置条件：
  - 目标卷存在章节数据
  - 最好已有 `VolumePlan`、`StoryThread`、`EndingReadiness` 中至少两类卷级真源
- 建议命令：
  - `novel doctor volume <volumeId>`
  - `novel state volume <volumeId>`
  - `novel snapshot volume <volumeId>`
- 核心检查点：
  - diagnostics 中应至少包含：
    - `stalledThreadCount`
    - `closureGapCount`
    - `neglectedThreadCount`
    - `missionChainGapCount`
    - `ensembleRiskCount`
  - 当卷级真源存在明显异常时，doctor 输出应反映风险升高
- 失败后重点查看：
  - [`src/cli/commands/doctor/volume-services.ts`](src/cli/commands/doctor/volume-services.ts:11)
  - [`src/cli/commands/doctor/volume-printers.ts`](src/cli/commands/doctor/volume-printers.ts:3)
  - [`src/cli/commands/state/volume.ts`](src/cli/commands/state/volume.ts:7)
- 建议保留 artifact：
  - `doctor volume <volumeId>` 输出
  - `state volume <volumeId>` 输出
  - `snapshot volume <volumeId>` 输出

## 记录建议

每次执行卷级回归，建议至少保存：

- 执行前 [`snapshot volume <volumeId>`](src/cli/commands/snapshot/volume.ts:7) 输出
- 执行后 [`snapshot volume <volumeId>`](src/cli/commands/snapshot/volume.ts:7) 输出
- [`doctor volume <volumeId>`](src/cli/commands/doctor/volume.ts:7) 输出
- [`state threads <volumeId>`](src/cli/commands/state/threads.ts:7) 与 [`state volume-plan <volumeId>`](src/cli/commands/state/volume-plan.ts:7) 输出
- `logs/operations/` 中对应 `runId` 的日志片段

## artifact 规范建议

建议后续为每次卷级回归固定保留以下 artifact：

- `caseName`
- `targetId`
- 执行时间
- 关键命令输出快照
- `doctor` / `state` / `snapshot` 对应输出
- 对应 `logs/operations/` 中的相关日志片段
- 结论摘要：`pass / warning / missing-prerequisite / fail`

## 命令验收口径

命令层至少应满足：

- `workflow` 域支持：
  - `plan volume-window <chapterId>`
  - `plan volume-show <volumeId>`
  - `plan mission-show <chapterId>`
  - `review volume <volumeId>`
- `state` 域支持：
  - `state threads [volumeId]`
  - `state volume-plan <volumeId>`
  - `state ending`
  - `state volume <volumeId>`
- `doctor` 域支持：
  - `doctor volume <volumeId>`
- `snapshot` 域支持：
  - `snapshot volume <volumeId>`
- `regression` 域支持：
  - `regression list`
  - `regression run <caseName> [targetId]`
  - `regression volume <volumeId>`

## 后续扩展建议

后续如果继续增强真实执行器，优先顺序建议是：

1. `volume-plan-smoke`
2. `mission-carry-smoke`
3. `thread-progression-smoke`
4. `ending-readiness-smoke`
5. `volume-doctor-smoke`

这样可以先验证：卷计划 -> mission -> thread progress -> ending readiness -> doctor 风险诊断 的主链是否闭环。
