# AI 自动写小说工具 v0 模块级开发清单

## 1. 这份清单怎么用

- 这不是产品方案，而是面向开工的模块级任务表
- 每个模块都包含目标、前置依赖、交付件和完成定义
- 执行时建议严格按依赖顺序推进，不要并行铺太多面

建议执行原则：

1. 先打穿主链路，再补体验
2. 先保证数据可落库，再做智能生成
3. 先保证 `approve` 闭环，再做复杂状态
4. 每个阶段都要留下可运行结果，不做“只写一半”的大模块

## 2. 总体执行顺序

推荐按下面顺序推进：

1. `foundation`：CLI、配置、路径、错误模型
2. `db`：SQLite、迁移、事务
3. `schema/repository`：实体表与仓储
4. `seed commands`：基础录入命令
5. `planning`：计划上下文与章节计划包
6. `generation`：正文生成
7. `review`：审查报告
8. `rewrite`：定向重写与候选版本
9. `approve`：终稿确认与导出
10. `state/memory/hooks`：最小状态闭环
11. `audit`：日志与流程追踪

## 3. 模块拆分

## A. `src/shared/types`

### 目标

沉淀全局共享的领域实体、视图类型和流程契约，避免各模块私自定义结构。

### 前置依赖

- 无

### 交付件

- `domain.ts`：`Book`、`Outline`、`Volume`、`Chapter`、`Character` 等实体
- `views.ts`：`LocationView`、`FactionView`、`ContextItem` 等查询/上下文视图
- `contracts.ts`：`ChapterPlan`、`ReviewReport`、`RewriteRequest`、`ApproveResult` 等流程契约
- `common.ts`：ID、时间戳、分页、错误码等基础类型

### 完成定义

- 全项目共享类型只从这里导出
- 不再在具体模块中重复定义同名结构
- 类型之间的引用闭合完整

---

## B. `src/shared/utils`

### 目标

提供所有模块都会复用的基础工具函数。

### 前置依赖

- `src/shared/types`

### 交付件

- ID 生成器
- 时间格式化工具
- 章节文件名清洗函数
- 字数估算函数
- JSON 安全解析/序列化工具
- 简单断言与校验工具

### 完成定义

- CLI、仓储、导出模块都可复用这些工具
- 不在业务模块重复写通用逻辑

---

## C. `src/cli`

### 目标

提供统一命令入口、参数解析、错误输出和帮助文案。

### 前置依赖

- `src/shared/types`
- `src/shared/utils`

### 交付件

- CLI 主入口
- 命令注册器
- 参数解析器
- 帮助信息输出
- 命令执行错误包装

### 必做命令

- `init`
- `outline set`
- `volume add`
- `chapter add`
- `character add`
- `location add`
- `faction add`
- `hook add`
- `plan chapter <id>`
- `write next`
- `review chapter <id>`
- `chapter rewrite <id>`
- `chapter approve <id>`

### 完成定义

- 所有命令都有统一调用入口
- 参数错误时能输出可读错误信息
- 所有命令都能接到对应 service 层

---

## D. `src/infra/db`

### 目标

封装 SQLite 连接、迁移、事务与数据库初始化逻辑。

### 前置依赖

- `src/shared/types`

### 交付件

- SQLite 连接管理器
- `db migrate` 内部执行逻辑
- 事务包装器
- 项目初始化建库逻辑
- migration 文件约定

### 完成定义

- `novel init` 可自动创建数据库并跑迁移
- 事务可供 `approve` 阶段复用
- 数据库连接生命周期清晰

---

## E. `src/infra/repository`

### 目标

实现实体级仓储，让业务层不直接拼 SQL。

### 前置依赖

- `src/infra/db`
- `src/shared/types`

### 第一批仓储

- `BookRepository`
- `OutlineRepository`
- `VolumeRepository`
- `ChapterRepository`
- `CharacterRepository`
- `LocationRepository`
- `FactionRepository`
- `HookRepository`

### 第二批仓储

- `ChapterPlanRepository`
- `ChapterDraftRepository`
- `ChapterReviewRepository`
- `ChapterRewriteRepository`
- `ChapterVersionRepository`
- `StoryStateRepository`
- `MemoryRepository`

### 完成定义

- 所有核心实体和流程产物都能落库
- 业务层不出现原始 SQL 字符串散落

---

## F. `src/core/book`

### 目标

负责项目级配置、书籍配置和大纲录入。

### 前置依赖

- `src/infra/repository`

### 交付件

- 书籍初始化 service
- 大纲设置 service
- 书籍查询 service

### 完成定义

- 可以创建并读取一本书的主配置
- 可以更新大纲并持久化

---

## G. `src/core/world`

### 目标

负责卷章、角色、地点、势力、钩子等基础世界设定的录入与读取。

### 前置依赖

- `src/infra/repository`

### 交付件

- `volume add`
- `chapter add`
- `character add`
- `location add`
- `faction add`
- `hook add`

### 完成定义

- 所有基础设定都能录入数据库
- 后续 planning/generation 模块能直接读取这些数据

---

## H. `src/core/context`

### 目标

统一组装规划上下文和写作上下文，避免 prompt 组装逻辑散落。

### 前置依赖

- `src/infra/repository`
- `src/core/state`
- `src/core/memory`
- `src/core/hooks`

### 交付件

- `PlanningContextBuilder`
- `WritingContextBuilder`
- 相关实体筛选规则
- 长期记忆召回策略（v0 版）

### 完成定义

- planning 和 writing 都能得到稳定、可复用的上下文对象
- 上下文内容可记录日志用于排错

---

## I. `src/infra/llm`

### 目标

为 LLM 提供统一适配层，业务层只依赖抽象接口。

### 前置依赖

- `src/shared/types`

### 交付件

- `LlmAdapter` 实现
- 文本生成接口
- 结构化生成接口
- prompt 输入封装
- 基础重试与错误包装

### 完成定义

- planning、generation、review、rewrite 都可复用同一适配层
- Provider 细节不泄漏到业务层

---

## J. `src/core/planning`

### 目标

基于 `PlanningContext` 生成章节计划包，并执行最小校验。

### 前置依赖

- `src/core/context`
- `src/infra/llm`
- `src/infra/repository`

### 交付件

- 计划 prompt builder
- `ChapterPlan` 生成 service
- 计划一致性校验器
- 计划落库逻辑

### 完成定义

- 可以针对指定章节生成计划包
- 计划包至少含 `objective`、`sceneCards`、`eventOutline`、`hookPlan`
- 校验失败时给出明确问题项

---

## K. `src/core/generation`

### 目标

严格基于章节计划包生成正文草稿。

### 前置依赖

- `src/core/context`
- `src/infra/llm`
- `src/infra/repository`

### 交付件

- 写作 prompt builder
- 草稿生成 service
- 字数统计
- 草稿落库逻辑

### 完成定义

- `write next` 可输出草稿
- 草稿与对应计划包可建立关联
- 能记录实际字数

---

## L. `src/core/review`

### 目标

基于草稿和计划包生成审查报告。

### 前置依赖

- `src/core/context`
- `src/infra/llm`
- `src/infra/repository`

### 交付件

- review prompt builder
- `ReviewReport` 生成 service
- 字数偏差检查器
- 审查记录落库逻辑

### 完成定义

- `review chapter <id>` 能输出结构化报告
- 至少覆盖一致性、节奏、钩子、字数四类问题

---

## M. `src/core/rewrite`

### 目标

根据 `RewriteRequest` 和审查报告生成候选重写版本。

### 前置依赖

- `src/core/review`
- `src/infra/llm`
- `src/infra/repository`

### 交付件

- rewrite prompt builder
- 候选版本生成 service
- 重写版本保存逻辑
- 当前候选版本选择逻辑

### 完成定义

- 可对当前章节执行重写
- 不会直接覆盖终稿和主线状态

---

## N. `src/core/state`

### 目标

管理 v0 范围内的最小故事状态更新。

### 前置依赖

- `src/infra/repository`
- `src/shared/types`

### v0 仅管理

- 当前推进章节
- 主角当前位置
- 最近关键事件

### 交付件

- `StateUpdateService`
- 章节确认后的状态更新逻辑
- 当前状态读取逻辑

### 完成定义

- `approve` 后可更新最小主线状态
- 下一章的 planning 能读到更新后的状态

---

## O. `src/core/hooks`

### 目标

管理钩子状态的推进、回收和推荐。

### 前置依赖

- `src/infra/repository`
- `src/infra/llm`

### 交付件

- 钩子提取/更新 service
- 活跃钩子读取逻辑
- 下一章钩子建议生成逻辑

### 完成定义

- `approve` 后可以更新钩子状态
- planning 阶段可以读取当前活跃钩子

---

## P. `src/core/memory`

### 目标

实现 v0 级别的短期记忆和轻量长期记忆。

### 前置依赖

- `src/infra/repository`
- `src/infra/llm`

### v0 仅管理

- 最近几章摘要
- 最近关键事件
- 高重要度长期事实

### 交付件

- 短期记忆重算逻辑
- 长期记忆候选提炼逻辑
- 记忆召回逻辑

### 完成定义

- planning/generation 可拿到短期记忆
- 长期记忆只注入高价值条目

---

## Q. `src/core/approve`

### 目标

把终稿确认、状态提交、导出文件、审计记录收束成一次事务性动作。

### 前置依赖

- `src/core/rewrite`
- `src/core/state`
- `src/core/hooks`
- `src/core/memory`
- `src/infra/db`
- `src/infra/audit`

### 交付件

- `approve` application service
- 数据库事务编排
- 终稿文件导出器
- `ApproveResult` 输出

### 完成定义

- `approve` 是唯一终稿确认入口
- 成功后章节状态更新为 `finalized`
- 文件导出、状态更新、日志记录要么全部成功，要么全部回滚

---

## R. `src/infra/audit`

### 目标

记录章节处理过程，便于后续追溯与排错。

### 前置依赖

- `src/infra/db`

### 交付件

- 审计日志写入器
- 章节版本日志写入器
- 运行流水号或 request id

### 完成定义

- 计划、草稿、审查、重写、确认这些关键动作均有记录
- 排查失败时能快速定位到哪一步出问题

## 4. 阶段内执行顺序

## Phase 1：先能初始化和录入

1. `src/shared/types`
2. `src/shared/utils`
3. `src/infra/db`
4. `src/infra/repository`
5. `src/cli`
6. `src/core/book`
7. `src/core/world`

阶段目标：能 `init` 并录入基础设定。

---

## Phase 2：打通写作主链路

1. `src/infra/llm`
2. `src/core/context`
3. `src/core/planning`
4. `src/core/generation`
5. `src/core/review`
6. `src/core/rewrite`

阶段目标：能 `plan -> write -> review -> rewrite`。

---

## Phase 3：补确认与状态闭环

1. `src/core/state`
2. `src/core/hooks`
3. `src/core/memory`
4. `src/infra/audit`
5. `src/core/approve`

阶段目标：能 `approve` 并把主线推进下去。

## 5. 每个阶段的最小交付件

## Phase 1 最小交付

- 命令能运行
- SQLite 能落库
- 基础设定能录入和读取

## Phase 2 最小交付

- 章节计划包可生成
- 草稿可生成
- 审查报告可生成
- 重写候选可生成

## Phase 3 最小交付

- 终稿可确认
- 终稿文件可导出
- 当前主线状态可更新
- 下一章上下文可续接

## 6. 开发节奏建议

### 每天的最佳推进方式

建议只盯一个主模块，不要一天铺两三个大模块。

例如：

- Day 1：`cli + db`
- Day 2：`repository + book/world`
- Day 3：`context + planning`
- Day 4：`generation + review`
- Day 5：`rewrite + approve`
- Day 6：`state + hooks + memory`
- Day 7：`audit + 收尾`

### 每完成一个模块都要自查

- 是否有明确输入输出
- 是否已定义落库位置
- 是否已处理失败路径
- 是否能被 CLI 串起来

## 7. 建议你现在就开始做的第一批任务

如果马上进入 coding，我建议按下面 8 个任务开工：

1. 建 `src/shared/types` 基础类型文件
2. 建 `src/infra/db` 的 SQLite 连接与 migration runner
3. 建 `src/infra/repository` 的基础仓储接口
4. 建 `src/cli` 命令骨架
5. 实现 `novel init`
6. 实现 `outline set`
7. 实现 `volume add` 和 `chapter add`
8. 跑通一次“初始化 -> 录入设定”最小链路

## 8. 一句话总纲

v0 的真实开发顺序不是“把所有模块都建出来”，而是：

> 先让数据能进，再让计划能出，再让正文能写，最后让终稿能确认并推进状态。
