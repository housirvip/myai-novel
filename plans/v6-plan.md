# v6 可维护性与测试基线总计划

## 1. v6 总目标

`v6` 的目标不是继续增加新的创作链路，而是把当前项目从“功能已经逐步成型”推进到“关键代码容易理解、关键行为容易验证、后续改动更可控”的状态。

这一期主要解决两个长期维护问题：

1. 当前系统仍有大量关键语义依赖读代码时自行推断，理解成本偏高
2. 高风险逻辑虽然已经越来越多，但正式单元测试保护面仍然不足

因此，`v6` 的总体目标可以定义为：

> 为当前小说工作流系统建立一套可持续复用的“注释 + 测试 + 验收”维护基线，让团队接手、重构调整、基础设施演进都更安全。

这份计划与 [`plans/v6-task-breakdown.md`](plans/v6-task-breakdown.md:1) 的关系是：

- 这里回答 **为什么做、优先做什么、按什么原则做**
- task breakdown 回答 **具体拆成哪些任务、按什么阶段落地**

---

## 2. 为什么需要 v6

### 2.1 当前项目已经进入“维护质量决定迭代效率”的阶段

经过 `v4 / v5 / v5.1` 的持续推进，当前项目已经具备：

- 清晰的分层结构：`shared / infra / core / cli`
- 较完整的主链路：`planning / generation / review / rewrite / approve`
- 较明确的外围支撑：`doctor / regression / snapshot / state`
- 较稳定的版本文档、CLI 命令与基础设施抽象

这意味着项目现在的主要瓶颈，已经不是“功能能不能先跑起来”，而是：

- 新人能不能快速读懂系统
- 后续改动会不会轻易破坏既有语义
- 重构时是否有足够低成本的回归验证手段

### 2.2 当前风险更多来自隐式知识，而不是功能缺口

目前仓库里最明显的问题，不是“没有模块”，而是“模块的设计意图没有稳定显式化”：

- 有些核心文件已经有注释，但覆盖不均匀
- 有些类型有字段说明，但缺少业务语义边界
- 有些 service 能看出流程，但很难直接读出输入真源、输出真源和 fallback 原因
- 某些 `LLM / DB / state / regression` 相关逻辑，仍然需要串联多处实现才能还原意图

这会带来几个长期成本：

- 新人接手恢复上下文慢
- 未来自己回看时理解成本高
- 很容易误改那些“看起来能删、实际上承载兼容或降级语义”的分支

### 2.3 当前需要一套正式测试基线来承接后续演进

虽然项目功能已经显著扩展，但如果没有稳定测试基线，很多关键逻辑仍然主要依赖：

- 手工运行命令
- 回归 case 的间接兜底
- 修改者对上下文的个人理解

这对于以下模块都不够安全：

- `shared/utils`
- `infra/llm`
- `infra/db`
- `core/*/service`
- `cli/commands/*/services`

所以，`v6` 的价值不在于扩新能力，而在于：

- 把关键知识显式化
- 把高风险逻辑资产化
- 把维护方式标准化

---

## 3. v6 设计原则

### 3.1 优先保关键语义清晰，不追求平均化注释覆盖

`v6` 不追求“所有文件都均匀补注释”，而是优先处理那些：

- 业务语义密集
- 分支决策复杂
- 回归代价高
- 最容易被误解或误改

的关键模块。

### 3.2 注释必须服务于理解与维护，而不是机械翻译代码

注释要解决的是源码里最难直接读出的信息，例如：

- 这个模块在架构中的职责
- 这个类型在业务上的边界与真义
- 这个 service 的输入真源、输出真源与副作用
- 这个 fallback / retry / rule-based 分支为什么存在

### 3.3 测试优先保护高价值逻辑，而不是先追漂亮覆盖率数字

`v6` 的测试优先级应集中在：

- 高频改动模块
- 基础设施路由与错误治理
- 规则推导与结果归并逻辑
- 很容易被“顺手简化”但实际上风险很高的逻辑

覆盖率会被持续关注，但不应先于价值判断。

### 3.4 允许为可测试性做小规模结构收口，但不做大规模震荡式重构

如果为了写测试需要：

- 抽出纯函数
- 增加 helper
- 缩小依赖边界
- 改善返回结构

这类调整是合理的。

但 `v6` 不应演变成：

- 大规模接口改写
- 纯为测试服务的过度抽象
- 对既有稳定主链造成扰动的结构性重写

### 3.5 注释、实现、测试、文档必须形成统一口径

`v6` 不是做几件彼此分散的小事，而是建立一套长期一致性：

- 注释定义职责与边界
- 实现体现这些边界
- 测试约束关键行为
- 文档固化新增规范与验收口径

---

## 4. v6 主线拆分

### M0：定义注释标准与测试标准

目标：先统一“什么样的注释算足够、什么样的测试算有价值”，避免执行过程中口径漂移。

#### 模块任务

- 定义文件级、类型级、函数级、关键分支级注释标准
- 定义测试目录、命名、helper 与优先级约定
- 明确 `P0 / P1 / P2` 注释优先级
- 明确第一批必测模块与验收口径

#### 完成定义

- 团队对 `v6` 注释补全标准有统一判断口径
- 团队对“先测哪里、为什么先测”有稳定共识

### M1：补齐 P0 核心模块注释

目标：先把最关键、最容易误读、最影响后续测试设计的模块注释补齐。

#### 重点模块

- [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)
- [`src/shared/utils/env.ts`](src/shared/utils/env.ts:1)
- [`src/shared/utils/errors.ts`](src/shared/utils/errors.ts:1)
- [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:1)
- [`src/infra/llm/`](src/infra/llm)
- [`src/infra/db/`](src/infra/db)
- [`src/core/planning/service.ts`](src/core/planning/service.ts:1)
- [`src/core/generation/service.ts`](src/core/generation/service.ts:1)
- [`src/core/review/service.ts`](src/core/review/service.ts:1)
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:1)
- [`src/core/approve/service.ts`](src/core/approve/service.ts:1)
- [`src/cli/context.ts`](src/cli/context.ts:1)
- [`src/cli/commands/*/services.ts`](src/cli/commands)

#### 完成定义

- 主链 service 的输入、输出、依赖边界、降级语义清晰可读
- `LLM / DB / CLI` 核心装配意图不再依赖隐式知识

### M2：建立正式单测基础设施

目标：为当前 Node + TypeScript CLI 项目建立一套低摩擦、可持续扩展的测试基线。

#### 推荐方案

本期优先采用：

> `node:test` + `tsx`

原因：

- 与当前项目技术栈匹配度高
- 接入成本低
- 不引入额外重测试框架负担
- 能先解决“正式可跑、可查、可扩”的问题

#### 模块任务

- 在 [`package.json`](package.json:1) 中增加测试脚本
- 新增 `tsconfig.test.json`
- 建立 `tests/unit/*`、`tests/helpers/`、`tests/fixtures/`、`tests/tmp/` 目录约定
- 建立基础 helper，如 `withEnv()`、SQLite helper、临时目录 helper 等
- 建立基础 coverage 输出能力

#### 完成定义

- 项目存在正式测试入口
- 测试代码可运行、可类型检查、可输出覆盖率
- 新增测试不再需要临时约定目录与方式

### M3：补第一批高价值单测

目标：先形成一批真正能防回归的测试，而不是只把基础设施空壳搭出来。

#### 第一优先级模块

- [`src/shared/utils/env.ts`](src/shared/utils/env.ts:1)
- [`src/shared/utils/errors.ts`](src/shared/utils/errors.ts:1)
- [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:1)
- [`src/infra/llm/factory.ts`](src/infra/llm/factory.ts:1)
- [`src/infra/llm/request-runtime.ts`](src/infra/llm/request-runtime.ts:1)
- [`src/infra/db/database.ts`](src/infra/db/database.ts:1)
- 关键 repository 与 SQLite 路径

#### 第二优先级模块

- [`src/core/planning/service.ts`](src/core/planning/service.ts:1)
- [`src/core/generation/service.ts`](src/core/generation/service.ts:1)
- [`src/core/review/service.ts`](src/core/review/service.ts:1)
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:1)

#### 第三优先级模块

- [`src/cli/commands/doctor/services.ts`](src/cli/commands/doctor/services.ts:1)
- [`src/cli/commands/regression/services.ts`](src/cli/commands/regression/services.ts:1)
- [`src/cli/commands/state/services.ts`](src/cli/commands/state/services.ts:1)
- [`src/cli/commands/workflow-services.ts`](src/cli/commands/workflow-services.ts:1)

#### 完成定义

- 至少有一批测试对 `env / llm / db / review / rewrite / doctor / regression / state / workflow` 提供真实保护面
- 后续修改关键规则时，有明确可运行的回归入口

### M4：维护规范、验收口径与后续扩展位

目标：让 `v6` 的成果可以进入长期维护流程，而不是一次性工程。

#### 模块任务

- 固化新增单测的最小约定
- 固化何时必须补测试、何时至少补注释
- 补开发者向测试与维护文档
- 补阶段性验收清单
- 明确 coverage 的阶段策略：先有输出，再逐步提升关键目录覆盖要求

#### 完成定义

- 注释补全和单测补齐成为后续版本的默认维护动作
- `v6` 的维护基线可持续复用到 `v7+`

---

## 5. v6 推荐执行顺序

建议按以下顺序推进：

1. 先定义注释标准与测试标准
2. 再补 `domain.ts + core/*/service.ts + infra/llm/* + infra/db/*` 的 P0 注释
3. 再建立测试脚本、测试配置与目录结构
4. 再覆盖 `shared / infra / db / llm` 第一批基础测试
5. 再覆盖 `core / cli services / regression / doctor / state / workflow` 高价值测试
6. 最后收口文档、测试说明与验收清单

这样安排的原因是：

- 没有统一标准，注释与测试容易越补越散
- 先补关键注释，可以显著降低后续测试设计的理解成本
- 先建立测试基础设施，再补高价值测试，扩展成本最低
- 先保主链和基础设施，再扩大到命令查询层，更稳妥

---

## 6. v6 重点范围

### 6.1 注释补全重点

- `src/shared/types/domain.ts`
- `src/shared/utils/env.ts`
- `src/shared/utils/errors.ts`
- `src/shared/utils/project-paths.ts`
- `src/infra/llm/factory.ts`
- `src/infra/llm/request-runtime.ts`
- `src/infra/llm/openai-adapter.ts`
- `src/infra/llm/openai-compatible-adapter.ts`
- `src/infra/db/database.ts`
- `src/infra/db/migrate.ts`
- `src/infra/db/mysql-adapter.ts`
- `src/core/context/planning-context-builder.ts`
- `src/core/context/writing-context-builder.ts`
- `src/core/planning/service.ts`
- `src/core/generation/service.ts`
- `src/core/review/service.ts`
- `src/core/rewrite/service.ts`
- `src/core/approve/service.ts`
- `src/cli/context.ts`
- `src/cli/commands/*/services.ts`

### 6.2 单测建设重点

- `src/shared/utils/`
- `src/infra/llm/`
- `src/infra/db/`
- `src/infra/repository/` 中高价值 repository
- `src/core/planning/service.ts`
- `src/core/generation/service.ts`
- `src/core/review/service.ts`
- `src/core/rewrite/service.ts`
- `src/cli/commands/doctor/services.ts`
- `src/cli/commands/regression/services.ts`
- `src/cli/commands/state/services.ts`
- `src/cli/commands/workflow-services.ts`

### 6.3 测试基础设施建议目录

- `tests/unit/shared/`
- `tests/unit/infra/`
- `tests/unit/core/`
- `tests/unit/cli/`
- `tests/helpers/`
- `tests/fixtures/`
- `tests/tmp/`（如需临时 SQLite 文件）

---

## 7. v6 验收标准

`v6` 完成时，至少应满足以下结果：

### 7.1 注释侧

- P0 核心模块具有统一风格的关键注释
- 主链、LLM、DB、CLI 装配层的职责与边界可直接从代码读懂
- 关键 fallback / retry / rule-based 分支具备可解释性

### 7.2 测试侧

- 项目具备正式 `test`、测试类型检查、coverage 输出能力
- 第一批高价值模块已建立真实保护面
- 新增测试的目录、helper、命名与约定已经稳定

### 7.3 维护侧

- `v6` 的成果已经写入测试文档、验收清单或相关开发文档
- 后续迭代可以沿用这套“注释 + 测试 + 验收”的基线继续推进

---

## 8. 与 task breakdown 的衔接

这份计划是 `v6` 的上层说明，具体落地拆解见：

- [`plans/v6-task-breakdown.md`](plans/v6-task-breakdown.md:1)

如果后续需要继续细化验收口径与执行结果，建议同步维护：

- [`plans/v6-acceptance-checklist.md`](plans/v6-acceptance-checklist.md:1)
- [`plans/v6-maintainability-test-plan.md`](plans/v6-maintainability-test-plan.md:1)

这样可以形成 `v6` 的三层结构：

- `v6-plan`：解释目标、原则、主线与范围
- `v6-task-breakdown`：解释阶段与任务拆解
- `v6-acceptance-checklist`：解释最终验收口径