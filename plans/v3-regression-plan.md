# v3 回归计划

## 目标

固化 `v3` 的标准回归路径，确保 `drop`、状态系统、质量分层、策略型重写与运维命令可重复验证。

## 核心回归样本

- `hook-pressure-smoke`
  - 目标：验证高压力 Hook 会进入 planning / review / approve / state
  - 关注：[`src/core/planning/service.ts`](src/core/planning/service.ts:19)、[`src/core/review/service.ts`](src/core/review/service.ts:28)、[`src/core/approve/service.ts`](src/core/approve/service.ts:60)
- `state-continuity-smoke`
  - 目标：验证角色 / 物品 / Hook 状态连续性在 review 与 approve 中不丢失
  - 关注：[`src/core/review/service.ts`](src/core/review/service.ts:46)、[`src/core/approve/service.ts`](src/core/approve/service.ts:88)
- `chapter-drop-safety`
  - 目标：验证 [`ChapterDropService.dropChapter()`](src/core/chapter-drop/service.ts:1) 只清当前链路、不默认回滚主状态
- `review-layering-smoke`
  - 目标：验证 [`reviewLayers`](src/shared/types/domain.ts:449) 与 [`rewriteStrategySuggestion`](src/shared/types/domain.ts:443) 能进入 rewrite
- `rewrite-strategy-smoke`
  - 目标：验证 [`RewriteService.rewriteChapter()`](src/core/rewrite/service.ts:31) 能根据分层问题切换策略

## 标准执行顺序

1. `novel snapshot chapter <chapterId>`
2. `novel review chapter <chapterId>`
3. `novel chapter rewrite <chapterId> --goal "增强结尾牵引"`
4. `novel doctor chapter <chapterId>`
5. `novel snapshot chapter <chapterId>`
6. 检查 `logs/operations/` 与 `logs/errors/`

## 通过标准

- `plan / draft / review / rewrite / output` 链路可追溯
- `state show` 与 `state-updates show <chapterId>` 可解释状态变化
- `review show <chapterId>` 能展示分层问题
- `rewrite show <chapterId>` 能展示策略型重写信息
- `chapter drop <chapterId>` 的结果可从日志复盘
