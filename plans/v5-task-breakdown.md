# v5-task-breakdown.md

## 1. 这份文档的用途

这份文档把 [`plans/v5-llm-mysql-plan.md`](plans/v5-llm-mysql-plan.md:1) 进一步拆成可以直接进入实现的任务清单。

它只聚焦两条主线：

1. `LLM` 通用抽象与多提供商接入
2. 通过配置在 `SQLite / MySQL` 之间二选一的数据库后端

---

## 2. v5 总执行策略

建议严格按下面顺序推进：

1. 先抽 `LLM` 接口与配置
2. 再补第二个 provider
3. 再抽数据库 client 接口
4. 再补 `MySQL` adapter 与配置
5. 最后补命令、回归与文档

原因：

- 先抽象，后接实现，返工更少
- 先保住现有 SQLite / OpenAI 可用性，再扩数据库后端选择能力
- `v4.1` 的 regression / doctor 体系可以为后续重构兜底

---

## 3. v5 模块总览

### M0 目标

建立 `LLM provider` 的统一抽象层与配置入口。

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts:971)

- 扩展 `PromptInput` / `GenerateResult` / `LlmAdapter` 的能力边界
- 新增 provider、model、metadata、retry / timeout 相关类型
- 为后续 gateway 层预留标准返回结构

#### B. [`src/shared/utils/env.ts`](src/shared/utils/env.ts:5)

- 扩展为通用 LLM 配置读取
- 增加 `LLM_PROVIDER`
- 增加通用模型配置
- 保持现有 OpenAI 配置兼容

#### C. [`src/infra/llm/factory.ts`](src/infra/llm/factory.ts:5)

- 从单分支工厂改成 provider registry / dispatch
- 为 provider 未配置、provider 不支持、provider 配置错误补清晰错误口径

#### D. [`src/infra/llm/`](src/infra/llm)

- 保留 [`src/infra/llm/openai-adapter.ts`](src/infra/llm/openai-adapter.ts:18)
- 新增一个第二 provider adapter
- 新增 shared gateway / error / normalization 相关文件

### M0 验收

- 通过配置可以选择 provider
- OpenAI 仍能正常运行
- 第二 provider 可以接入同一业务链路

---

### M1 目标

把 `planning / generation / review / rewrite` 的模型调用升级成按阶段可配置。

#### A. [`src/core/planning/service.ts`](src/core/planning/service.ts:31)

- 支持 planning 阶段模型选择
- 保留 rule-based fallback

#### B. [`src/core/generation/service.ts`](src/core/generation/service.ts:8)

- 支持 generation 阶段模型选择
- 增加 provider metadata 输出能力

#### C. [`src/core/review/service.ts`](src/core/review/service.ts:28)

- 支持 review 阶段模型选择
- 补结构化输出失败时的 retry / normalization 兜底

#### D. [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:25)

- 支持 rewrite 阶段模型选择
- 对卷级策略切换后的 prompt 输出保持一致性

### M1 验收

- 四条主链都能使用统一 LLM 抽象
- 可以按阶段选择不同模型或 provider
- metadata 至少能记录 provider / model

---

### M2 目标

建立统一数据库访问接口，把 [`better-sqlite3`](package.json:15) 从业务底层隔离出来。

#### A. [`src/infra/db/database.ts`](src/infra/db/database.ts:1)

- 从直接返回 SQLite 实例改成统一 DB client 入口
- 定义 query / execute / transaction 等最小接口

#### B. [`src/infra/db/migrate.ts`](src/infra/db/migrate.ts:4)

- 重构为基于 driver 的 migration runner
- 抽出 migration dialect 边界

#### C. [`src/infra/repository/`](src/infra/repository)

- 逐步把 repository 对具体驱动对象的依赖替换为统一 DB client
- 优先处理主链高频 repository

#### D. [`src/infra/db/schema.ts`](src/infra/db/schema.ts:1)

- 识别 SQLite 专属语法
- 为后续 MySQL dialect 做准备

### M2 验收

- repository 不再直接依赖 SQLite 专属类型
- SQLite 作为默认后端继续可跑完整主链

---

### M3 目标

增加 `MySQL` 可选后端支持，但不强制旧项目迁移。

#### A. [`package.json`](package.json:14)

- 增加 MySQL driver 依赖

#### B. [`src/shared/utils/env.ts`](src/shared/utils/env.ts:1)

- 增加数据库 provider 配置
- 增加 MySQL 连接配置

#### C. [`src/infra/db/`](src/infra/db)

- 新增 MySQL adapter
- 新增 driver 选择逻辑
- 补齐连接管理和事务封装

#### D. [`src/cli/context.ts`](src/cli/context.ts:8)

- 让打开项目数据库时按配置在 SQLite / MySQL 中二选一

#### E. [`src/cli/commands/project-commands.ts`](src/cli/commands/project-commands.ts:19)

- 让 `init` 支持按配置初始化不同数据库后端
- 不要求旧 SQLite 项目迁移

### M3 验收

- 项目可按配置二选一使用 SQLite / MySQL
- 旧 SQLite 项目无需修改仍可运行
- MySQL 至少能跑初始化、主链与核心状态命令

---

### M4 目标

补齐 `v5` 的命令、文档、回归与诊断口径。

#### A. [`.env.example`](.env.example)

- 增加 LLM provider 和 MySQL 配置示例

#### B. [`COMMAND_GUIDE.md`](COMMAND_GUIDE.md:1)

- 增加 provider 选择说明
- 增加 SQLite / MySQL 使用方式说明

#### C. [`src/cli/commands/doctor/`](src/cli/commands/doctor)

- 增加 provider / database backend 诊断信号

#### D. [`src/cli/commands/regression/`](src/cli/commands/regression)

- 增加 provider smoke case
- 增加 MySQL backend smoke case

#### E. `plans/`

- 新增 `v5` regression cases 文档
- 固化 acceptance 与 fallback 口径

### M4 验收

- 用户知道如何切 provider 和数据库后端
- 新基础设施能力具备最小可用 regression 保护面
- 文档、实现、验收口径一致

---

## 4. 第一批推荐执行任务

1. 重构 [`src/shared/utils/env.ts`](src/shared/utils/env.ts:5) 与 [`src/infra/llm/factory.ts`](src/infra/llm/factory.ts:5)
2. 为 [`src/infra/llm/`](src/infra/llm) 增加第二 provider adapter
3. 重构 [`src/infra/db/database.ts`](src/infra/db/database.ts:1) 建立 DB client 接口
4. 先让 SQLite adapter 跑在新抽象下
5. 再接入 MySQL adapter 与配置

---

## 5. v5 执行清单

- [ ] 建立通用 LLM provider 抽象与工厂分发
- [ ] 支持至少两个 LLM provider 并行接入
- [ ] 为 planning / generation / review / rewrite 增加阶段级模型路由
- [ ] 为 LLM 输出补 provider / model / fallback metadata
- [ ] 建立统一数据库 client 接口
- [ ] 让 SQLite 运行在新数据库抽象之下
- [ ] 增加 MySQL adapter 与连接配置
- [ ] 让新项目可选 SQLite / MySQL 初始化
- [ ] 增加 provider / backend 的 doctor 与 regression 覆盖
- [ ] 固化 `v5` 文档、环境变量示例与验收口径

---

## 6. 边界

当前这份 `v5` task breakdown 不包含：

- 自动数据迁移工具
- 在线服务化部署
- 多实例并发治理
- 多租户隔离

当前只聚焦：

- LLM 抽象与多 provider
- 通过配置在 SQLite / MySQL 间二选一的后端
- 配置、回归、文档与验收收口
