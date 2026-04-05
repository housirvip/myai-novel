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
- 建议命令：
  - `novel plan volume-window <chapterId>`
  - `novel plan volume-show <volumeId>`
  - `novel state volume-plan <volumeId>`

### `mission-carry-smoke`
- 目的：验证当前章 mission 可以被查看，并能进入 generation / rewrite / review 链路
- 建议命令：
  - `novel plan chapter <chapterId>`
  - `novel plan mission-show <chapterId>`
  - `novel write next <chapterId>`
  - `novel review chapter <chapterId>`

### `thread-progression-smoke`
- 目的：验证线程焦点、thread progress、volume review / state threads 可以形成闭环观察
- 建议命令：
  - `novel state threads <volumeId>`
  - `novel review volume <volumeId>`
  - `novel doctor volume <volumeId>`

### `ending-readiness-smoke`
- 目的：验证终局准备度可以被 state / doctor / snapshot / regression 侧查看
- 建议命令：
  - `novel state ending`
  - `novel snapshot volume <volumeId>`
  - `novel regression volume <volumeId>`

### `volume-doctor-smoke`
- 目的：验证卷级 doctor 能暴露主线停滞、回收缺口、mission 断链、群像风险等信号
- 建议命令：
  - `novel doctor volume <volumeId>`
  - `novel state volume <volumeId>`
  - `novel snapshot volume <volumeId>`

## 记录建议

每次执行卷级回归，建议至少保存：

- 执行前 [`snapshot volume <volumeId>`](src/cli/commands/snapshot/volume.ts:7) 输出
- 执行后 [`snapshot volume <volumeId>`](src/cli/commands/snapshot/volume.ts:7) 输出
- [`doctor volume <volumeId>`](src/cli/commands/doctor/volume.ts:7) 输出
- [`state threads <volumeId>`](src/cli/commands/state/threads.ts:7) 与 [`state volume-plan <volumeId>`](src/cli/commands/state/volume-plan.ts:7) 输出
- `logs/operations/` 中对应 `runId` 的日志片段

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
  - `regression run <caseName>`
  - `regression volume <volumeId>`

## 后续扩展建议

后续如果接入真实执行器，优先顺序建议是：

1. `volume-plan-smoke`
2. `mission-carry-smoke`
3. `thread-progression-smoke`
4. `ending-readiness-smoke`
5. `volume-doctor-smoke`
