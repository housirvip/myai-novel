# v3 最小回归样本清单

## 目标

提供一套最小可用的样本占位，便于 [`regression`](src/cli/commands/regression-commands.ts:7) 后续接入真实执行器。

## 样本列表

### `hook-pressure-smoke`
- 目的：验证高压力 Hook 会进入 planning / review / approve / state
- 建议命令：
  - `novel plan chapter <chapterId>`
  - `novel review chapter <chapterId>`
  - `novel state show`

### `state-continuity-smoke`
- 目的：验证角色 / 物品 / Hook 状态不会在主链路中断裂
- 建议命令：
  - `novel write next <chapterId>`
  - `novel review chapter <chapterId>`
  - `novel state-updates show <chapterId>`

### `review-layering-smoke`
- 目的：验证 [`reviewLayers`](src/shared/types/domain.ts:449) 能被生成并展示
- 建议命令：
  - `novel review chapter <chapterId>`
  - `novel review show <chapterId>`

### `rewrite-strategy-smoke`
- 目的：验证策略型重写能根据 review 分层问题切换策略
- 建议命令：
  - `novel chapter rewrite <chapterId> --goal "增强结尾牵引"`
  - `novel rewrite show <chapterId>`

### `chapter-drop-safety`
- 目的：验证 [`chapter drop`](src/cli/commands/chapter-commands.ts:289) 只清当前链路，不默认回滚主状态
- 建议命令：
  - `novel chapter show <chapterId>`
  - `novel chapter drop <chapterId> --all-current`
  - `novel doctor chapter <chapterId>`

## 记录建议

每次回归建议至少保存：

- 执行前 [`snapshot chapter`](src/cli/commands/snapshot-commands.ts:53) 输出
- 执行后 [`snapshot chapter`](src/cli/commands/snapshot-commands.ts:53) 输出
- [`doctor chapter`](src/cli/commands/doctor-commands.ts:62) 输出
- `logs/operations/` 中对应 `runId` 的日志片段
