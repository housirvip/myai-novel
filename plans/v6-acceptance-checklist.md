# v6 验收清单

本清单用于确认 `v6` 是否已经达到“可理解、可验证、可维护、可持续扩展”的目标。

配套文档建议结合阅读：

- 总体计划：[`plans/v6-plan.md`](plans/v6-plan.md:1)
- 任务拆解：[`plans/v6-task-breakdown.md`](plans/v6-task-breakdown.md:1)
- 专项计划：[`plans/v6-maintainability-test-plan.md`](plans/v6-maintainability-test-plan.md:1)

---

## 1. 注释补全基线

- [x] `src/shared/types/domain.ts` 已具备核心对象图谱级说明
- [x] `src/core/planning/service.ts` 已标明主链职责、输入、输出、fallback 语义
- [x] `src/core/generation/service.ts` 已标明主链职责、输入、输出、fallback 语义
- [x] `src/core/review/service.ts` 已标明主链职责、输入、输出、关键判定语义
- [x] `src/core/rewrite/service.ts` 已标明主链职责、输入、输出、关键判定语义
- [x] `src/core/approve/service.ts` 已标明批准阶段的提交职责与状态闭环范围
- [x] `src/infra/llm/*` 已说明 provider 路由、fallback、timeout / retry / error 分类语义
- [x] `src/infra/db/*` 已说明 SQLite / MySQL 边界、migration 行为与驱动差异
- [x] `src/cli/commands/*/services.ts` 已说明查询装配层职责，而不是仅堆叠 repository

---

## 2. 测试基础设施基线

- [x] `package.json` 已具备 `test / test:watch / test:coverage / check:test` 脚本
- [x] `tsconfig.test.json` 已纳入 `tests/**/*.ts` 的类型检查
- [x] `tests/unit/` 目录结构已按模块分层
- [x] `tests/helpers/` 已具备环境变量、临时目录、mock fetch、cwd、sqlite helper
- [x] `tests/tmp/` 已被忽略，不会污染仓库
- [x] `npm test` 能稳定执行全部测试
- [x] `npm run check:test` 能稳定通过
- [x] `npm run test:coverage` 能输出覆盖率报告

---

## 3. 第一批高价值单测保护面

### shared / utils

- [x] `src/shared/utils/env.ts` 已覆盖默认值、stage routing、timeout / retry 规则
- [x] `src/shared/utils/errors.ts` 已覆盖错误对象与错误文本归一化
- [x] `src/shared/utils/project-paths.ts` 已覆盖路径推导、目录创建、配置读写

### infra / llm

- [x] `src/infra/llm/factory.ts` 已覆盖 provider 选择、fallback、stage routing 元数据
- [x] `src/infra/llm/request-runtime.ts` 已覆盖 timeout、retry、status -> category 映射

### cli / services

- [x] `src/cli/commands/doctor/services.ts` 已覆盖 bootstrap 视图、provider / backend 可读性口径
- [x] `src/cli/commands/regression/services.ts` 已覆盖 unknown case、provider smoke、database smoke、mixed config validation

### core / pure logic

- [x] `src/core/review/service.ts` 已覆盖 mission progress、closure normalization、review layers 策略生成
- [x] `src/core/rewrite/service.ts` 已覆盖 rewrite strategy、quality target、validation 逻辑
- [x] `src/core/planning/service.ts` 已覆盖 plan normalize、hook action、rule-based plan 关键输出
- [x] `src/core/generation/service.ts` 已覆盖 generation prompt payload、fallback draft 结构与字数估算

### infra / sqlite integration

- [x] `src/infra/db/database.ts` 已覆盖 SQLite 打开、事务回滚、migrations 基线
- [x] `src/infra/repository/book-repository.ts` 已覆盖基本持久化与读取
- [x] `src/infra/repository/chapter-plan-repository.ts` 已覆盖完整 plan 持久化与 latest/version 查询

---

## 4. 覆盖率与保护面判断

- [x] 覆盖率报告已能稳定生成
- [x] 当前覆盖率评估以“高风险模块是否被覆盖”为第一标准，而非全仓数字本身
- [x] `shared/utils`、`infra/llm`、`core/review`、`core/rewrite`、`core/planning`、`core/generation` 至少已有首批直接测试
- [x] `infra/db` 与关键 repository 至少已有最小 SQLite 集成测试

---

## 5. 开发者维护约定

- [x] 已存在开发者向测试约定文档
- [x] 文档已说明如何新增一个单测
- [x] 文档已说明何时必须补测试
- [x] 文档已说明何时至少补注释
- [x] 文档已说明 helper / fixture / temp sqlite 的使用约定

---

## 6. 推荐最终验收命令

```bash
npm run check -- --pretty false
npm run check:test
npm test
npm run test:coverage
```

如需重点抽查已覆盖高风险区域，可额外关注：

```bash
node --import tsx --test tests/unit/shared tests/unit/infra tests/unit/core tests/unit/cli
```

---

## 7. 一句话验收标准

如果 `v6` 完成后：

- 关键模块的设计意图不再依赖作者脑补
- 高频高风险逻辑已有正式测试保护面
- 测试入口、类型检查、coverage、helper、约定都已存在

那么就说明项目已经从“能继续开发”进入“能稳定维护”的阶段。
