# v3 数据迁移说明

## 目标

说明 `v3` 期间新增迁移的作用、兼容重点和整洁化建议。

## 关键迁移

- [`011_chapter_outcomes`](src/infra/db/schema.ts:398)
  - 新增章节结果包与叙事债务 / 矛盾表
- [`012_narrative_pressure_state`](src/infra/db/schema.ts:462)
  - 新增人物弧线与 Hook 压力当前状态
- [`013_plan_pressure_targets`](src/infra/db/schema.ts:494)
  - 为 `chapter_plans` 增加高压力 Hook / 弧线 / 债务目标
- [`014_plan_scene_task_fields`](src/infra/db/schema.ts:501)
  - 为 `chapter_plans` 增加场景任务字段
- [`015_review_layers`](src/infra/db/schema.ts:514)
  - 为 `chapter_reviews` 增加分层问题结构
- [`016_rewrite_strategy_profile`](src/infra/db/schema.ts:521)
  - 为 `chapter_rewrites` 增加策略配置与质量目标

## 整洁化建议

- 历史 `review.decision = revise` 统一映射到 `needs-rewrite`
  - 兼容逻辑见 [`normalizeReviewDecision()`](src/infra/repository/chapter-review-repository.ts:139)
- 旧 rewrite validation 缺失扩展字段时，按默认结构补齐
- 对旧 review 缺失 `review_layers_json` 的记录，使用默认空分层结构回填
- 若历史日志不含 `detail` 字段，沿用兼容默认值并通过新命令重新采样

## 迁移执行建议

1. 先执行 [`novel doctor`](src/cli/commands/doctor-commands.ts:15)
2. 再执行项目启动迁移流程 [`runMigrations()`](src/infra/db/migrate.ts:1)
3. 执行 [`novel snapshot state`](src/cli/commands/snapshot-commands.ts:15)
4. 抽样检查 [`review show <chapterId>`](src/cli/commands/workflow-commands.ts:276) 与 [`rewrite show <chapterId>`](src/cli/commands/workflow-commands.ts:312)

## 风险提示

- 不要在未完成数据库备份时直接对生产样本做手工 SQL 清洗
- 对含 `finalized` 章节的项目，优先通过命令链路验证而不是直接改状态表
