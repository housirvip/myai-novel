# AI 自动写小说工具 v6 任务拆解

配套上层计划见 [`plans/v6-plan.md`](plans/v6-plan.md:1)。

建议阅读顺序：

1. 先看 [`plans/v6-plan.md`](plans/v6-plan.md:1)，理解 `v6` 的目标、原则与范围
2. 再看当前文档，理解 `v6` 的阶段拆解与任务落地方式
3. 最后结合 [`plans/v6-acceptance-checklist.md`](plans/v6-acceptance-checklist.md:1) 做验收

## 1. 这份文档的定位

- 这份文档不是继续扩新功能面
- 它的核心目标，是把当前项目从“功能链路已逐步成型”推进到“代码可读、关键语义可解释、核心逻辑可测试”
- `v6` 本期只聚焦两个高价值方向：
  1. **全局关键代码注释补全**
  2. **单元测试体系构建**

换句话说，`v6` 不是再去回答“还能增加什么能力”，而是回答：

> 当前这套系统，是否已经足够容易被人接手、足够容易被后续迭代安全修改、足够容易在重构时防止回归？

---

## 2. 当前基线判断

基于当前仓库状态，可以把现状概括为：

### 已具备的基础

- 项目已经形成较清晰的分层：
  - `shared`
  - `infra`
  - `core`
  - `cli`
- `planning / generation / review / rewrite / approve` 主链已经具备较完整语义
- `LLM provider`、`SQLite/MySQL`、`doctor / regression / snapshot` 等基础设施层已经有明确落点
- `plans/` 中已经形成较稳定的版本规划文档风格
- 在 `v4 / v5 / v5.1` 期间，部分核心模型和关键 service 已经有注释化基础

### 当前仍明显不足的部分

- 注释分布不均：
  - 有些核心文件注释较完整
  - 但大量关键实现仍依赖“读代码的人自己推断语义”
- 注释层级不统一：
  - 有些文件只有类型注释
  - 有些函数缺职责说明
  - 有些关键分支缺少“为什么这么做”的解释
- 当前几乎没有正式单测基础设施：
  - `package.json` 没有 `test` 脚本
  - 没有测试 runner 配置
  - 没有测试目录约定
  - 没有 fixtures / helpers / coverage 基线
- 当前 `tsconfig.json` 只覆盖 `src/**/*.ts`，测试代码尚未纳入类型检查体系
- 未来继续重构 `LLM / DB / review / state / regression` 等关键模块时，回归风险仍偏高

因此，`v6` 的重点不是继续铺功能，而是：

- 把关键代码的隐式知识显式化
- 把高风险逻辑变成可验证资产
- 为后续版本建立稳定的维护基线

---

## 3. v6 总目标

`v6` 的总目标定义为：

> 把当前项目从“作者自己能持续开发”推进到“团队能稳定接手、重构可控、核心逻辑可回归验证”。

更具体地说，`v6` 要解决四个问题：

1. 新人或未来的自己，能否快速看懂关键模型、主链 service、基础设施层的职责与边界？
2. 当修改 `LLM routing / DB adapter / review / state / regression` 时，是否有最小单测保护面？
3. 当前项目是否已具备一套可持续扩展的测试目录、脚本、约定与覆盖策略？
4. 注释、实现、测试三者是否能形成统一的长期维护口径？

---

## 4. v6 范围边界

`v6` **包含**：

- 关键文件的模块级、类型级、函数级注释补全
- 高风险纯逻辑与半纯逻辑模块的单测建设
- 测试脚本、目录、约定、基线覆盖策略建设
- 为测试可写性所做的**小规模结构收口**

`v6` **不优先包含**：

- 新的大功能模块
- 全量端到端测试体系
- 完整的 Docker 化测试矩阵
- 覆盖所有 CLI 命令的快照测试
- 仅为了“形式好看”而进行的大规模无收益重构

也就是说：

- 这期要优先保住 **关键代码可理解性** 和 **关键逻辑可回归性**
- 而不是追求“每个文件都写满注释”或“测试覆盖率数字先冲高”

---

## 5. v6 执行策略

建议按以下顺序推进：

1. 先定义 **注释标准** 与 **测试标准**
2. 再补 **P0 核心模块注释**
3. 再建立 **单测基础设施**
4. 再覆盖 **第一批高价值纯逻辑 / 网关 / 基础设施单测**
5. 最后收口 **文档、脚本、验收标准**

原因：

- 没有统一标准，注释很容易越补越乱
- 没有测试入口和目录约定，后续每加一个测试都会变成一次临时决策
- 先补关键注释，再写单测，能显著降低理解成本和测试设计误差
- 先覆盖纯逻辑和高风险模块，比一上来写 CLI 端到端更稳、更便宜

---

## 6. v6 模块总览

### 注释补全重点模块

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
- `src/cli/commands/doctor/services.ts`
- `src/cli/commands/regression/services.ts`

### 单测建设重点模块

- `src/shared/utils/`
- `src/infra/llm/`
- `src/infra/db/`
- `src/core/planning/service.ts`
- `src/core/review/service.ts`
- `src/core/rewrite/service.ts`
- `src/cli/commands/doctor/services.ts`
- `src/cli/commands/regression/services.ts`

### 新增测试基础设施建议目录

- `tests/unit/shared/`
- `tests/unit/infra/`
- `tests/unit/core/`
- `tests/unit/cli/`
- `tests/helpers/`
- `tests/fixtures/`
- `tests/tmp/`（如需临时 sqlite 文件）

---

## 7. 里程碑拆解

## V6-A：关键代码注释标准与 P0 模块补全

### 目标

建立统一的关键代码注释标准，并优先把最核心、最容易误解、最容易被误改的模块注释补齐。

### 模块任务

#### A. 注释标准定义

建议统一以下层次：

1. **文件级注释**：说明这个文件在架构里的职责
2. **类型 / 类级注释**：说明它表达的业务语义，而不只是“字段列表”
3. **函数级注释**：说明输入、输出、副作用、关键前置条件
4. **关键分支注释**：说明“为什么这么做”，尤其是 fallback / dialect / consistency 分支

#### B. `src/shared/types/domain.ts`

重点补强：

- 核心领域模型总说明
- 各阶段对象之间的关系说明
- `ChapterPlan / VolumePlan / ReviewReport / ChapterRewrite / LlmExecutionMetadata` 的职责边界

完成定义：

- 仅看 `domain.ts` 就能理解当前系统的关键对象图谱

#### C. `src/core/` 主链 service

重点补强：

- `PlanningService`
- `GenerationService`
- `ReviewService`
- `RewriteService`
- `ApproveService`

注释必须回答：

- 该 service 在主链中的位置是什么
- 它依赖哪些真源输入
- 它会写入哪些真源输出
- 降级 / fallback / rule-based 分支的存在原因是什么

完成定义：

- 主链 service 的核心决策点可以直接从代码注释读懂

#### D. `src/infra/llm/` 与 `src/infra/db/`

重点补强：

- provider 选择与 fallback 策略
- timeout / retry / error 分类语义
- SQLite / MySQL 的职责边界
- migration runner 的 backend 行为差异

完成定义：

- 基础设施层的关键行为不再依赖隐式知识

#### E. `src/cli/context.ts` + `src/cli/commands/*/services.ts`

重点补强：

- 命令装配层职责
- 查询视图与 printer 的边界
- 为什么某些命令必须走 async 路径

完成定义：

- CLI 装配层的设计意图清晰，不再像“只是把仓储堆起来”

### 完成定义

- P0 模块具备统一风格的关键注释
- 主链、LLM、DB、CLI 核心语义可以直接从代码读取
- 后续写单测时，测试意图可以直接映射到注释结构

---

## V6-B：单测基础设施搭建

### 目标

建立一套低摩擦、Node 项目友好、可逐步扩展的单元测试体系。

### 推荐方案

本期建议优先采用：

> **`node:test` + `tsx`**

原因：

- 当前项目是 Node CLI / TypeScript 项目，不依赖前端构建链
- 当前仓库没有任何测试依赖，优先选低引入成本方案更稳
- `tsx` 已经存在于 devDependencies，可直接支撑 TS 测试运行
- 可先把“测试能跑起来”作为目标，后续若 mocking 复杂度上升，再评估是否升级到 `vitest`

### 模块任务

#### A. `package.json`

建议新增脚本：

- `test`
- `test:watch`
- `test:coverage`
- `check:test`

建议目标形态：

- 能直接运行 TS 测试
- 能单独做测试代码类型检查
- 能输出基础覆盖率报告

#### B. `tsconfig.test.json`

建议新增单独测试配置，而不是直接污染当前 `tsconfig.json`。

原因：

- 当前 `rootDir=src`
- 当前 `include` 仅覆盖 `src/**/*.ts`
- 测试代码应有独立编译边界

建议承担职责：

- 包含 `tests/**/*.ts`
- 允许测试辅助文件存在
- 保持与主工程 NodeNext / ESM 口径一致

#### C. 测试目录与命名约定

建议约定：

- `*.test.ts`：标准单测文件
- `tests/helpers/`：测试构造器、fake、assert helper
- `tests/fixtures/`：固定输入/输出样本
- `tests/tmp/`：临时文件与 sqlite 测试数据

#### D. 基础测试工具收口

建议补一批通用测试 helper：

- `withEnv()`：临时切换环境变量
- `withTempDir()`：创建临时目录
- `createTempSqliteProject()`：构造最小项目目录
- `mockFetch()`：测试 LLM runtime / adapter 时替换全局 `fetch`
- `assertJsonShape()`：结构化对象断言辅助

### 完成定义

- 项目存在正式测试脚本
- 测试目录、命名、helper 约定明确
- 测试代码可运行、可类型检查、可统计基础覆盖率

---

## V6-C：第一批高价值单测覆盖

### 目标

优先覆盖“改动频繁 + 风险高 + 逻辑相对可拆”的模块，形成第一道真实保护网。

### 优先级建议

#### P0：纯逻辑 / 低依赖模块

建议优先覆盖：

- `src/shared/utils/env.ts`
  - provider 解析
  - stage 路由解析
  - timeout / retry 默认值与覆盖规则
- `src/shared/utils/errors.ts`
  - 错误分类对象的构造与口径
- `src/shared/utils/project-paths.ts`
  - 路径解析逻辑

完成定义：

- 环境变量与路径规则不再靠手工试错验证

#### P1：LLM 网关层

建议优先覆盖：

- `src/infra/llm/factory.ts`
  - provider 选择
  - stage routing
  - fallback 顺序
  - metadata 合并
- `src/infra/llm/request-runtime.ts`
  - timeout
  - retry
  - status -> errorCategory 映射

完成定义：

- LLM 路由与失败治理成为可回归验证资产

#### P2：核心 service 中的纯逻辑片段

建议优先覆盖：

- `src/core/planning/service.ts`
  - normalize / fallback 相关函数
  - rule-based plan 关键输出结构
- `src/core/review/service.ts`
  - issue merge 规则
  - mission / thread / ending 判断逻辑
  - closureSuggestions / reviewLayers / outcomeCandidate 组装
- `src/core/rewrite/service.ts`
  - rewrite strategy 选择
  - quality target 推导
  - context summary / protected facts 组装

这里要注意：

- 不建议为了测试把所有内部函数都粗暴导出
- 应优先抽出真正稳定、可复用、可测试的 helper

完成定义：

- `planning / review / rewrite` 的关键推导逻辑具备可回归保护面

#### P3：基础设施视图与回归执行层

建议优先覆盖：

- `src/cli/commands/doctor/services.ts`
  - infrastructure view 构造
  - backend / provider / stage routing 展示口径
- `src/cli/commands/regression/services.ts`
  - case 识别
  - projectless / project-required 分流
  - 各 smoke case 的结果对象结构

完成定义：

- `doctor / regression` 自身的输出口径也能被测试约束

### 完成定义

- 至少形成一批真正能防回归的高价值单测
- 测试重点覆盖主链外围高风险逻辑，而不是只测低价值样板代码

---

## V6-D：测试可写性收口与维护规范

### 目标

让测试体系不是“一次性搭出来”，而是后续版本能持续扩展。

### 模块任务

#### A. 小规模可测试性重构

仅在必要时进行：

- 抽取私有纯函数到 `shared` / `core/helpers`
- 降低构造函数依赖耦合
- 为高价值逻辑增加更稳定的输入输出边界

要求：

- 不做为了测试而测试的过度抽象
- 不做大规模接口震荡

#### B. 覆盖率策略

本期不建议一开始就设很高门槛。

建议先定义两层目标：

- **基线目标**：先有 coverage 输出能力
- **质量目标**：优先看高风险模块是否覆盖，而不是全仓数字是否漂亮

建议后续采用：

- 全仓最低覆盖率先不强卡
- 关键目录逐步设置门槛：
  - `shared/utils`
  - `infra/llm`
  - `core/review`
  - `core/rewrite`

#### C. 文档与团队约定

建议补充：

- 如何新增一个单测
- 何时必须补测试
- 哪类改动至少要补到哪一层测试
- 注释补全的最低要求

可选沉淀位置：

- `COMMAND_GUIDE.md`（只放用户可见命令测试相关很少）
- 新增 `plans/v6-acceptance-checklist.md`
- 或新增开发者向文档，如 `TESTING_GUIDE.md`

### 完成定义

- 测试不是一次性工程，而是进入长期维护流程
- 后续改核心逻辑时，能明确知道哪里该补注释、哪里该补单测

---

## 8. 注释补全优先级建议

建议按优先级分层推进，而不是“平均撒网”。

### P0：必须优先

- `domain.ts`
- `core/*/service.ts`
- `infra/llm/*`
- `infra/db/*`
- `cli/commands/*/services.ts`

### P1：建议补全

- `infra/repository/*`
- `cli/context.ts`
- `doctor / regression / snapshot / state` 的 service / printer

### P2：轻量补齐即可

- 纯 commander 注册文件
- 输出 printer 中明显直接的展示函数
- 机械映射型仓储中无分支的简单 CRUD

原则：

- 关键语义多、决策多、分支多的地方优先
- 样板代码不追求逐行注释

---

## 9. 单测优先级建议

本期建议采用“价值优先”而不是“覆盖率优先”。

### 第一批建议直接覆盖

1. `shared/utils/env.ts`
2. `infra/llm/factory.ts`
3. `infra/llm/request-runtime.ts`
4. `core/review/service.ts` 中的关键 merge / derive 逻辑
5. `core/rewrite/service.ts` 中的 strategy / target / summary 逻辑
6. `cli/commands/regression/services.ts`
7. `cli/commands/doctor/services.ts`

### 第二批再补

1. `core/planning/service.ts`
2. `core/generation/service.ts` 的纯逻辑辅助部分
3. `shared/utils/project-paths.ts`
4. SQLite 临时库上的 repository 级测试

### 第三批再考虑

1. CLI 命令层快照测试
2. MySQL 集成测试
3. 全链路场景测试

---

## 10. 第一批推荐执行任务

建议按以下顺序直接进入实现：

1. 建立 `v6` 注释标准与测试标准
2. 先补 `domain.ts + core/*/service.ts + infra/llm/* + infra/db/*` 注释
3. 新增测试脚本、`tsconfig.test.json`、测试目录结构
4. 先为 `env / llm factory / request-runtime` 建第一批单测
5. 再为 `review / rewrite / regression / doctor` 建高价值单测
6. 最后固化验收清单与开发者测试约定

---

## 11. v6 执行清单

- [x] 定义统一的关键代码注释标准
- [x] 补齐 P0 核心模块注释
- [x] 补齐 P1 关键基础设施与命令服务层注释
- [x] 建立正式单测脚本与测试目录约定
- [x] 增加 `tsconfig.test.json` 或等价测试类型检查方案
- [x] 建立测试 helper / fixture / temp project 基础设施
- [x] 覆盖 `env / llm factory / request-runtime` 第一批单测
- [x] 覆盖 `review / rewrite / doctor / regression` 第一批高价值单测
- [x] 建立基础 coverage 输出能力
- [x] 固化 `v6` 的验收与后续维护规范

---

## 12. 一句话结论

如果说 `v5 / v5.1` 的重点是“把基础设施和主链能力接起来并收口”，那么 `v6` 的任务就是：

> 把这套系统从“能继续写”推进到“能长期维护、能安全重构、能稳定交接”。
