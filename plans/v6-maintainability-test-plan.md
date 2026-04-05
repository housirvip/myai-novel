# v6 可维护性与单元测试基线计划

## 1. v6 总目标

`v6` 的目标不是继续扩张新的创作能力，而是把当前项目从“主链已能持续推进”升级到“关键语义可解释、核心逻辑可验证、后续重构可控”。

这一期主要解决两类长期维护问题：

1. 关键代码的隐式知识过多，理解成本仍偏高
2. 高风险模块缺少正式单元测试，修改后回归风险偏高

因此，`v6` 的总体目标可以定义为：

> 为当前小说工作流系统建立一套可长期维护的“注释 + 测试 + 验收”基线，让团队接手、后续重构、基础设施调整都更安全。

这份计划是对 [`plans/v6-task-breakdown.md`](plans/v6-task-breakdown.md:1) 的上层说明：

- 这里回答 **为什么做、优先做什么、按什么原则做**
- task breakdown 回答 **具体做到哪、分哪些阶段落地**

---

## 2. 为什么需要 v6

### 2.1 当前系统已经进入“维护质量决定迭代速度”的阶段

经过 `v4 / v5 / v5.1` 的推进，当前项目已经具备：

- 分层清晰的代码结构：`shared / infra / core / cli`
- 较完整的主链路：`planning / generation / review / rewrite / approve`
- 较明确的基础设施层：`LLM provider / SQLite / MySQL / doctor / regression / snapshot`
- 较稳定的 plans 文档组织方式与 CLI 命令体系

这意味着项目已经不再处于“先把功能跑通”的早期阶段，而是进入“如何稳定演进”的阶段。

### 2.2 当前的主要风险不再是功能缺失，而是知识隐式化

现在最明显的问题，不是功能完全没有，而是很多关键语义还停留在作者脑内或代码上下文推断里：

- 有些核心模块已有注释，但覆盖并不均匀
- 注释层级不一致，有的只有类型说明，有的缺职责边界，有的缺关键分支原因
- 某些 service、LLM gateway、DB adapter 的设计意图，需要读完整个文件甚至多处调用链才能拼出来

这会带来几个长期问题：

- 新人接手成本高
- 未来自己回看时恢复上下文慢
- 重构时容易误改“看起来可以简化、实际上承载兼容/降级语义”的逻辑

### 2.3 当前几乎没有正式单测基线

从仓库状态看，当前测试体系仍处于缺位状态：

- 没有正式 `test` 脚本
- 没有明确的测试 runner 约定
- 没有独立的测试 TypeScript 配置
- 没有测试目录、fixture、helper、coverage 基线

这意味着很多关键逻辑目前仍主要靠：

- 手工跑命令
- 回归 case 间接兜底
- 修改者对上下文的主观理解

这对基础设施层、小型重构、规则调整尤其不友好。

### 2.4 现在是补维护基线的合适时机

现在做 `v6` 是合适的，因为：

- 主链与基础设施已足够成型，值得为其补长期维护资产
- `doctor / regression / snapshot` 已存在，可作为测试体系的外围保护面
- 若再继续推进功能而不补注释和单测，后续每次调整的理解成本和回归风险都会继续累积

所以，`v6` 的价值不在于“加更多能力”，而在于：

- 把关键知识显式化
- 把高风险逻辑资产化
- 把维护方式标准化

---

## 3. v6 设计原则

### 3.1 先保关键语义清晰，再谈覆盖面扩张

`v6` 不追求“所有文件平均补注释”，而是优先补那些：

- 业务语义密集
- 决策分支多
- 回归代价高
- 新人最容易误解

的关键模块。

### 3.2 注释必须服务于理解和维护，而不是机械解释代码

注释的重点不是把代码翻译成中文，而是补齐源码里最难直接读出的信息，例如：

- 这个模块在架构中的职责
- 这个类型在业务中的边界
- 这个 service 的真源输入 / 真源输出是什么
- 某个 fallback / retry / rule-based 分支为什么存在

### 3.3 测试优先保护高价值逻辑，不先追求漂亮覆盖率数字

`v6` 的测试策略应优先覆盖：

- 高频改动模块
- 关键规则推导模块
- 基础设施路由与错误治理模块
- 很容易因为“看起来可以简化”而被误改的逻辑

而不是先把大量低价值样板代码测满。

### 3.4 为测试做小规模收口，但不做大规模结构震荡

如果为了写单测需要抽纯函数、补 helper、收窄依赖边界，这类调整是合理的。

但 `v6` 不应演变成：

- 大规模接口重写
- 纯为测试而设计的过度抽象
- 对现有稳定链路造成额外扰动的重构

### 3.5 注释、实现、测试、文档必须形成统一口径

`v6` 不只是补一点注释、写几个测试，而是建立长期一致性：

- 注释说明职责与边界
- 实现体现这些边界
- 测试约束关键行为
- 文档固化新增约定与验收标准

---

## 4. v6 主线拆分

### M0：定义注释与测试标准

目标：先明确“什么样的注释算够用、什么样的测试算有价值”，避免边做边漂移。

#### 模块任务

- 定义文件级、类型级、函数级、关键分支级注释标准
- 定义单测优先级与目录约定
- 明确哪些模块属于 `P0 / P1 / P2` 注释优先级
- 明确哪些模块属于第一批必测范围

#### 完成定义

- 团队对 `v6` 的注释补全标准有统一口径
- 团队对“先测哪里、为什么先测”有统一判断标准

### M1：补齐 P0 核心模块注释

目标：先把最关键、最容易误读、最影响后续测试设计的模块注释补齐。

#### 重点模块

- [`src/shared/types/domain.ts`](src/shared/types/domain.ts:1)
- [`src/core/planning/service.ts`](src/core/planning/service.ts:1)
- [`src/core/generation/service.ts`](src/core/generation/service.ts:1)
- [`src/core/review/service.ts`](src/core/review/service.ts:1)
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:1)
- [`src/core/approve/service.ts`](src/core/approve/service.ts:1)
- [`src/infra/llm/`](src/infra/llm)
- [`src/infra/db/`](src/infra/db)

#### 完成定义

- 主链 service 的输入、输出、依赖边界、降级语义清晰可读
- `LLM / DB` 基础设施的路由、错误、fallback 与后端差异不再依赖隐式知识

### M2：建立正式单测基础设施

目标：为当前 Node + TypeScript CLI 项目建立一套低摩擦、可持续扩展的测试基线。

#### 推荐方案

优先采用：

> `node:test` + `tsx`

理由是：

- 当前项目不依赖前端测试生态
- 引入成本低
- 与现有 TypeScript / NodeNext 结构匹配度高
- 能先解决“测试正式可跑、可查、可扩”的问题

#### 模块任务

- 在 [`package.json`](package.json:1) 增加测试相关脚本
- 新增 `tsconfig.test.json`
- 建立 `tests/unit/*`、`tests/helpers/`、`tests/fixtures/`、`tests/tmp/` 目录约定
- 建立基础 helper，如 `withEnv()`、`withTempDir()`、`mockFetch()` 等
- 建立基础 coverage 输出能力

#### 完成定义

- 项目存在正式测试入口
- 测试代码可运行、可类型检查、可统计基础覆盖率
- 新增测试不再需要临时拍脑袋决定目录和方式

### M3：补第一批高价值单测

目标：先形成一批真正能防回归的测试，而不是只搭空壳。

#### 第一优先级模块

- [`src/shared/utils/env.ts`](src/shared/utils/env.ts:1)
- [`src/shared/utils/errors.ts`](src/shared/utils/errors.ts:1)
- [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:1)
- [`src/infra/llm/factory.ts`](src/infra/llm/factory.ts:1)
- [`src/infra/llm/request-runtime.ts`](src/infra/llm/request-runtime.ts:1)

#### 第二优先级模块

- [`src/core/planning/service.ts`](src/core/planning/service.ts:1) 中可稳定抽测的纯逻辑片段
- [`src/core/review/service.ts`](src/core/review/service.ts:1) 中 issue merge / outcome derive 等关键逻辑
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts:1) 中 strategy / target / protected facts 相关逻辑

#### 第三优先级模块

- [`src/cli/commands/doctor/services.ts`](src/cli/commands/doctor/services.ts:1)
- [`src/cli/commands/regression/services.ts`](src/cli/commands/regression/services.ts:1)

#### 完成定义

- 至少有一批测试能对 `env / llm / review / rewrite / regression / doctor` 提供真实保护面
- 后续修改关键规则时，有明确可运行的回归验证入口

### M4：维护规范、验收口径与后续扩展位

目标：让 `v6` 的成果不是一次性工程，而能进入长期维护流程。

#### 模块任务

- 固化新增单测的最小约定
- 固化何时必须补测试、何时至少补注释
- 补开发者向文档或验收清单
- 明确 coverage 的阶段性策略：先有输出，再逐步对关键目录设门槛

#### 完成定义

- 注释补全和单测补齐变成后续版本的默认维护动作
- `v6` 的维护基线可以持续复用到后续 `v7+`

---

## 5. v6 推荐执行顺序

建议按以下顺序推进：

1. 先定义注释标准与测试标准
2. 再补 `domain.ts + core/*/service.ts + infra/llm/* + infra/db/*` 的 P0 注释
3. 再建立测试脚本、测试配置与目录结构
4. 再覆盖 `env / llm factory / request-runtime` 第一批基础单测
5. 再覆盖 `review / rewrite / doctor / regression` 的高价值单测
6. 最后固化验收清单、测试约定与开发者文档

这个顺序的理由是：

- 没有统一标准，注释和测试都会越做越散
- 没有正式测试入口，后续每个测试都会变成临时设计
- 先补关键注释，能降低写测试时的理解成本和误判概率
- 先测纯逻辑与高风险外围，再逐步向更复杂模块推进，投入产出比更高

---

## 6. 注释专项策略

### 6.1 P0：必须优先补齐

- `shared/types/domain.ts`
- `core/*/service.ts`
- `infra/llm/*`
- `infra/db/*`
- `cli/commands/*/services.ts`

这些文件的共同特点是：

- 语义密度高
- 对后续改动影响面大
- 决策分支与兼容逻辑多
- 很容易因为缺上下文而被误改

### 6.2 P1：建议补齐

- `infra/repository/*`
- `cli/context.ts`
- `doctor / regression / snapshot / state` 中承载设计意图的 service / printer

### 6.3 P2：轻量补齐即可

- 纯 commander 注册文件
- 机械式展示函数
- 无复杂分支的简单仓储 CRUD

原则是：

- 注释资源优先投到“高决策密度”代码
- 不把时间花在低价值逐行翻译上

---

## 7. 测试专项策略

### 7.1 第一阶段先覆盖纯逻辑与基础设施路由

第一批测试最值得覆盖的是：

- 环境变量解析与默认值规则
- provider / stage routing / fallback 决策
- timeout / retry / errorCategory 映射
- 路径规则与项目目录约束

这是因为这些逻辑：

- 改动频率不低
- 很少有 UI 或交互层兜底
- 一旦出错，容易在主链上产生“症状分散”的问题

### 7.2 第二阶段覆盖核心 service 的稳定推导逻辑

重点不是把整个 service 变成可随便 mock 的空壳，而是：

- 抽出真正稳定的 helper
- 为关键推导逻辑建立稳定输入输出边界
- 让测试直接约束规则，而不是绑死实现细节

### 7.3 第三阶段再考虑更重的测试形态

`v6` 暂不优先：

- 全量 CLI 快照测试
- 全链路端到端测试矩阵
- MySQL 大规模集成测试
- Docker 化测试编排

这些能力未来可以做，但不应抢占本期最有收益的维护投资。

---

## 8. v6 边界

`v6` 重点做的是：

- 关键语义显式化
- 正式单测基础设施落地
- 第一批高价值单测形成保护面
- 后续维护规范与验收口径收口

`v6` 不优先做的是：

- 新的大功能模块
- 全覆盖率冲刺
- 全仓快照测试
- 全链路复杂集成测试矩阵
- 为了测试而进行的大规模重构

也就是说，`v6` 的核心产出不是“功能更多”，而是“后续改动更稳”。

---

## 9. 预期交付结果

完成 `v6` 后，理想状态应当是：

1. 新人或未来的自己，只看关键文件注释，就能快速理解核心对象图谱与主链边界
2. `LLM / DB / review / rewrite / regression / doctor` 的高风险逻辑有正式测试保护面
3. 仓库中已经有清晰的测试脚本、测试目录、测试 helper 和 coverage 入口
4. 后续功能迭代时，团队知道何时该补注释、何时该补测试、至少补到哪一层

如果说 `v5 / v5.1` 的重点是把基础设施和工作流链路接起来，那么 `v6` 的意义就是：

> 把这套系统从“能继续开发”推进到“能稳定维护、能安全重构、能可靠交接”。