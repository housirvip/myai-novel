# AI 自动写小说工具 v1 模块级任务拆解

## 1. 这份文档的用途

- 这份文档是 [`plans/v1-state-first-plan.md`](plans/v1-state-first-plan.md) 的执行层拆解版本
- 目标不是再解释设计思路，而是回答“接下来具体先写什么文件、做什么模块、按什么顺序推进”
- 适合直接拿来排开发任务

## 2. v1 的总执行策略

`v1` 的核心不是继续扩命令数量，而是让“状态”成为真正驱动生成的真源。

因此执行顺序必须是：

1. 先建状态真源
2. 再让上下文读取这些真源
3. 再让审查检查这些真源是否被违背
4. 最后让 `approve` 成为统一状态提交入口

如果反过来做，会出现：

- 表建了但没人用
- review 还在看文本表层
- approve 还在写最小占位状态

## 3. v1 模块总览

`v1` 建议优先新增或强化的模块：

- `src/core/state`
- `src/core/context`
- `src/core/review`
- `src/core/approve`
- `src/infra/repository/character-current-state`
- `src/infra/repository/item`
- `src/infra/repository/item-current-state`
- `src/infra/repository/hook-state`
- `src/infra/repository/memory`
- `src/infra/repository/chapter-state-updates`

## 4. 里程碑拆解

## M1：角色位置与 Hook 进入上下文

### M1 目标

先解决最直接影响连贯性的两件事：

- 人物在哪
- 当前有哪些活跃钩子

### M1 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补充或细化：

- `CharacterCurrentState`
- `HookCurrentState`
- `PlanningContext` 增加角色状态与钩子状态字段
- `WritingContext` 增加角色状态与钩子状态字段

完成定义：

- 角色状态和钩子状态不再只是仓储表概念，而是明确进入上下文类型

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

补强数据表：

- `character_current_state`
- 若已有 `hook_current_state`，补必要字段，例如 `note`、`updated_by_chapter_id`

完成定义：

- 能记录角色当前位置、状态备注、最新更新时间
- 能追踪活跃钩子当前状态

#### C. `src/infra/repository/character-current-state-repository.ts`

交付件：

- `getByCharacterId`
- `listByBookId`
- `upsert`

完成定义：

- 角色当前位置可结构化读写

#### D. [`src/infra/repository/hook-state-repository.ts`](src/infra/repository/hook-state-repository.ts)

补强：

- `listActiveByBookId`
- `listByBookId`
- `upsertBatch`

完成定义：

- planning / writing 可以读取当前活跃钩子

#### E. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)

补强：

- 注入主角位置
- 注入关键角色当前位置
- 注入当前活跃钩子

完成定义：

- planning 输入中明确带有“角色位置 + 活跃钩子”

#### F. [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts)

补强：

- 写作上下文同样注入角色位置和活跃钩子

完成定义：

- 正文生成不再只看计划包，也看真实状态

#### G. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 从章节结果中提取主角位置变化
- 更新角色状态表
- 更新活跃钩子状态

完成定义：

- approve 后下一章 planning 能读到新的角色位置和钩子状态

### M1 验收

- 下一章 planning 可以读到主角当前位置
- 下一章 writing 可以读到当前活跃钩子
- `review` 能发现角色位置不一致或钩子承接缺失

---

## M2：物品状态闭环

### M2 目标

让“关键物品”真正成为连续写作的约束，而不是自由生成出来的临时概念。

### M2 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

新增或补强：

- `Item`
- `ItemCurrentState`
- `ContextItemView`

完成定义：

- 物品有实体层、当前状态层、上下文视图层三层结构

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

新增：

- `items`
- `item_current_state`

字段至少包括：

- `item_id`
- `owner_character_id`
- `location_id`
- `quantity`
- `status`
- `updated_at`

#### C. `src/infra/repository/item-repository.ts`

交付件：

- `create`
- `getById`
- `listByBookId`

#### D. `src/infra/repository/item-current-state-repository.ts`

交付件：

- `getByItemId`
- `listImportantByBookId`
- `upsert`

#### E. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)

补强：

- 注入本章相关重要物品

#### F. [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts)

补强：

- 注入关键物品状态

#### G. [`src/core/review/service.ts`](src/core/review/service.ts)

补强：

- 新增物品一致性检查

#### H. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 提交物品状态变化

### M2 验收

- 关键物品能在章节前后追踪
- review 能指出物品归属或状态冲突

---

## M3：记忆闭环进入生成与审查

### M3 目标

把当前的 memory 从“写库”升级成“真的被用来约束生成和审查”。

### M3 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补强：

- `ShortTermMemory`
- `LongTermMemory`
- `MemoryRecallView`

#### B. [`src/infra/repository/memory-repository.ts`](src/infra/repository/memory-repository.ts)

补强：

- `getShortTermByBookId`
- `getLongTermByBookId`
- `recallRelevantLongTermEntries`

#### C. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)

补强：

- 注入最近章节摘要
- 注入最近关键事件
- 注入高重要长期记忆

#### D. [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts)

补强：

- 注入本章高相关长期记忆

#### E. [`src/core/review/service.ts`](src/core/review/service.ts)

补强：

- 增加长期事实一致性检查
- 增加“新事实候选”输出

#### F. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 短期记忆重算
- 长期记忆候选提炼与写入

### M3 验收

- planning / writing 上下文中可以实际看到记忆注入
- review 能报告长期事实冲突
- approve 后下一章能读到更新后的记忆

---

## M4：状态更新追溯与一致性排错

### M4 目标

让状态问题不是“只能看正文猜”，而是可以追溯到某一章、某一类更新。

### M4 模块任务

#### A. [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

新增：

- `chapter_state_updates`
- `chapter_memory_updates`
- `chapter_hook_updates`

#### B. `src/infra/repository/chapter-state-update-repository.ts`

交付件：

- `create`
- `listByChapterId`
- `listByBookId`

#### C. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 在 approve 时同时记录状态更新摘要

#### D. 可选：`src/cli.ts`

增加查询命令：

- `novel state show`
- `novel state-updates show <chapterId>`

### M4 验收

- 某个状态异常时，可以追溯是哪一章引入的
- review 发现一致性问题时，可以配合更新记录排查原因

## 5. 每阶段执行顺序

### 第一阶段：先打 M1

顺序：

1. `character_current_state` 表
2. `character-current-state-repository`
3. `hook-state-repository` 补强
4. `PlanningContextBuilder` 注入位置和活跃钩子
5. `WritingContextBuilder` 注入位置和活跃钩子
6. `ApproveService` 提交角色位置和钩子更新
7. `ReviewService` 增加位置/钩子一致性检查

### 第二阶段：做 M2

顺序：

1. `items` + `item_current_state`
2. item repository
3. context 注入物品
4. review 增加物品一致性检查
5. approve 提交物品变化

### 第三阶段：做 M3

顺序：

1. memory repository 补读取与召回
2. context 注入记忆
3. review 增加长期记忆一致性检查
4. approve 增强短期/长期记忆沉淀

### 第四阶段：做 M4

顺序：

1. 状态更新日志表
2. update repository
3. approve 写更新日志
4. show / trace CLI

## 6. 推荐你下一步直接开工的任务

如果下一轮进入 coding，我建议从下面 8 个任务开始：

1. 在 [`src/shared/types/domain.ts`](src/shared/types/domain.ts) 补 `CharacterCurrentState`
2. 在 [`src/infra/db/schema.ts`](src/infra/db/schema.ts) 新增 `character_current_state`
3. 新建 `src/infra/repository/character-current-state-repository.ts`
4. 补强 [`src/infra/repository/hook-state-repository.ts`](src/infra/repository/hook-state-repository.ts)
5. 升级 [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)
6. 升级 [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts)
7. 升级 [`src/core/review/service.ts`](src/core/review/service.ts)
8. 升级 [`src/core/approve/service.ts`](src/core/approve/service.ts)

## 7. 一句话总纲

`v1` 的开发顺序不是“先加更多写作能力”，而是：

> 先让系统知道人物在哪、伏笔到哪、东西在哪、哪些事实不能错，再让模型去写。
