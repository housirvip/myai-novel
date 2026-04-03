# AI 自动写小说工具 v2 设计方案

## 1. v2 总目标

`v2` 的目标不是继续扩更多命令，而是把 `v1` 已经跑通的“状态闭环”从**半结构化闭环**升级成**强结构化闭环**。

一句话定义：

> `v1` 解决的是状态开始进入主链路，`v2` 要解决的是状态提交、审查、回收、追溯都不再依赖正文猜测，而是依赖结构化事实。

`v2` 重点收口以下问题：

- `approve` 仍然大量依赖正文解析
- Hook 推进更偏计划驱动，而不是事实驱动
- 角色 / 物品状态提交仍容易落成 `未知`
- 长期记忆召回和冲突判断还偏轻量
- review 虽能发现问题，但还没有稳定产出“可直接提交状态”的结构化结果

---

## 2. v2 设计原则

### 2.1 结构化结果优先于正文猜测

- 正文是阅读产物
- 结构化状态是系统真源
- `approve` 不能再主要靠正文中的格式片段提取状态
- review / rewrite / approve 之间必须有结构化闭环载荷

### 2.2 计划、正文、审查、提交四段要统一状态语义

- planning 负责提出状态目标和约束
- writing 负责产出正文
- review 负责产出结构化闭环建议
- approve 负责提交结构化结果并落日志

### 2.3 真源更新必须可解释

- 每次状态提交都要回答：
  - 更新了谁
  - 为什么更新
  - 依据来自哪里
  - 与上一状态相比变了什么

### 2.4 长期一致性优先于单章通顺

- `v2` 优先解决跨章稳定性
- 即使某一章正文写得顺，只要破坏长期状态，也必须在 review 中被压住

---

## 3. v2 要解决的核心缺口

### 3.1 角色状态闭环还不够硬

当前问题：

- `approve` 对角色位置与状态更新仍依赖正文中是否出现结构化行
- 模型一旦写成自然正文，角色状态很容易沿用旧值或落成 `未知`

`v2` 目标：

- 让角色状态更新主要来自结构化闭环建议，而不是正文猜测
- 让主角位置、关键角色位置、阶段性状态变化形成可提交载荷

### 3.2 物品状态闭环还不够稳定

当前问题：

- 物品数量、地点、持有者仍主要依赖正文中的显式格式
- 对“状态变化是否真的发生”缺少结构化提交证据

`v2` 目标：

- 为关键物品提供结构化状态变更建议
- approve 时优先提交结构化物品结果

### 3.3 Hook 状态推进偏计划驱动

当前问题：

- Hook 当前推进主要根据 `hookPlan` 推导
- 缺乏“本章正文是否真正承接、是否推进、是否回收”的结构化提交结果

`v2` 目标：

- review 输出 Hook 闭环判断
- approve 不再只按 plan 推状态，而是按“计划 + 正文 + 审查建议”联合提交

### 3.4 记忆闭环已经存在，但召回与冲突判断仍偏轻

当前问题：

- 长期记忆召回还是关键词加权
- 冲突检查偏启发式
- review 能指出问题，但无法稳定沉淀成“本章确认事实”与“本章禁止推翻事实”

`v2` 目标：

- 强化长期记忆召回排序
- 区分长期稳定事实、短期事件、候选新事实
- 让 review 产出结构化 memory closure 建议

### 3.5 review 与 approve 之间缺一层结构化闭环协议

这是 `v2` 最重要的新增内容。

当前问题：

- review 给出的是问题列表和建议
- approve 提交的是正文解析结果
- 两者之间没有稳定协议

`v2` 目标：

- 增加 `closureSuggestions` 或等价结构化闭环结果
- review 存储这些建议
- approve 优先消费这些建议
- 正文解析只作为兜底，不再作为主路径

---

## 4. v2 核心范围

## P1：结构化闭环协议

新增统一的闭环载荷模型，至少覆盖：

- character closure suggestions
- item closure suggestions
- hook closure suggestions
- memory closure suggestions

这层协议将成为 `review -> approve` 的主通道。

完成标准：

- review 能输出闭环建议
- approve 能优先消费闭环建议
- 正文解析降级为兜底逻辑

## P2：角色 / 物品强闭环提交

目标：

- 角色位置与状态不再主要依赖正文中的 `角色（id）`
- 物品状态不再主要依赖正文中的 `物品（id）`

完成标准：

- approve 先提交结构化状态建议
- 若结构化建议缺失，才回退到正文解析
- 状态更新日志里要能显示变更依据

## P3：Hook 事实驱动提交

目标：

- Hook 更新不再只是 `hookPlan -> nextStatus`
- review 必须给出本章 Hook 的实际处理结果判断

完成标准：

- approve 提交 Hook 状态时能区分：
  - 计划推进但正文未承接
  - 正文承接但未完成 payoff
  - 正文完成回收

## P4：记忆系统升级

目标：

- 长期记忆召回从基础关键词匹配升级为更可靠的相关性策略
- review 能输出本章确认的新长期事实 / 仅短期保留事件 / 待观察事实

完成标准：

- planning / writing 的记忆输入更稳定
- approve 对记忆沉淀有更明确的分层策略

## P5：可解释追溯增强

目标：

- 不只是记录“变了什么”
- 还要记录“为什么变”和“依据是什么”

完成标准：

- `state-updates show` 可以扩展显示依据摘要
- review / approve / state trace 在调试上能串起来

---

## 5. v2 模块设计

### 5.1 类型层

建议重点演进：

- [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

新增或强化：

- `ClosureSuggestions`
- `CharacterStateClosureSuggestion`
- `ItemStateClosureSuggestion`
- `HookStateClosureSuggestion`
- `MemoryClosureSuggestion`

设计要求：

- 每条建议都要带 `reason`
- 每条建议都要指向明确实体
- Memory 类建议要区分短期 / 长期 / 观察态

### 5.2 review 层

重点文件：

- [`src/core/review/service.ts`](src/core/review/service.ts)
- [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts)
- [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

要做的事：

- 让 review 输出结构化闭环建议
- 将这些建议随审查结果一起落库
- `review show` 能把结构化闭环建议展示出来

### 5.3 approve 层

重点文件：

- [`src/core/approve/service.ts`](src/core/approve/service.ts)

要做的事：

- 优先读取最近 review 的结构化闭环建议
- 对角色 / 物品 / Hook / 记忆分别执行提交
- 仅在缺失时再回退正文解析

### 5.4 记忆层

重点文件：

- [`src/infra/repository/memory-repository.ts`](src/infra/repository/memory-repository.ts)
- [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)
- [`src/core/review/service.ts`](src/core/review/service.ts)

要做的事：

- 优化 recall 排序策略
- 加入基于 objective / hook / key item / chapter title 的联合召回
- 区分“长期稳定事实”和“短期事件”

### 5.5 CLI 展示层

重点文件：

- [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts)
- [`src/cli/commands/state-commands.ts`](src/cli/commands/state-commands.ts)

要做的事：

- `review show` 展示闭环建议
- `state-updates show` 展示更清晰的依据摘要
- 在调试模式下让 review / approve 产物更容易串联

---

## 6. v2 里程碑拆分

## M1：review 结构化闭环协议落地

交付：

- review 新增结构化闭环建议类型
- chapter review 持久化这些建议
- `review show` 可展示这些建议

验收：

- 每次 review 至少可以输出角色 / 物品 / Hook / 记忆中的一类结构化建议
- 即使 AI 没返回，也有规则兜底建议

---

## M2：approve 优先消费结构化建议

交付：

- approve 先读 review 的结构化建议
- 角色 / 物品 / Hook / 记忆分别按建议提交
- 正文解析改为 fallback

验收：

- 模型写成自然正文时，状态提交仍可稳定完成
- 角色与物品状态明显减少 `未知` 占比

---

## M3：Hook 与记忆强闭环

交付：

- Hook 提交变成“计划 + 审查建议 + 正文证据”联合判断
- 记忆分层沉淀策略升级
- 长期记忆召回更贴近章节真实需求

验收：

- Hook 状态不再主要依赖 `hookPlan` 直接推进
- review 能更稳定识别长期事实冲突和新事实归档边界

---

## M4：追溯与调试增强

交付：

- 状态更新日志增加依据说明
- CLI 能更好展示 review -> approve -> state trace 的关联

验收：

- 能快速定位某次状态变化来自哪条 review 建议
- 出现设定漂移时能定位问题源头

---

## 7. v2 验收标准

以下全部满足即可视为 `v2` 完成：

1. `review` 能稳定输出结构化闭环建议，而不只是问题列表
2. `approve` 优先消费结构化闭环建议，而不是主要依赖正文猜测
3. 角色位置与关键物品状态在真实模型正文下也能稳定提交
4. Hook 状态推进不再只是计划推导，而有事实与审查依据
5. 长期记忆召回与冲突判断比 `v1` 更稳、更可解释
6. 状态更新日志能展示“更新结果 + 更新依据”
7. `state show` 与 `state-updates show` 能为排查长线一致性问题提供足够证据

---

## 8. 推荐实施顺序

建议按下面顺序推进：

1. review 结构化闭环建议类型与落库
2. approve 优先消费闭环建议
3. Hook 提交升级
4. 记忆召回与沉淀升级
5. CLI 调试与追溯增强

原因：

- 没有统一闭环协议，后面所有增强都容易继续绕正文做猜测
- approve 如果还不先消费结构化结果，review 再强也只是“看得出来问题”，不是“交得出状态”
- Hook 和 memory 升级应该建立在协议已存在的基础上

---

## 9. 与 v1 的关系

`v2` 不是推翻 [`plans/v1-state-first-plan.md`](plans/v1-state-first-plan.md)，而是接着它做“强闭环化”。

可以这样理解：

- `v1`：让状态真的进入主链路
- `v2`：让状态提交不再依赖正文猜测

如果说 `v1` 解决的是“系统开始知道人物在哪、东西在哪、伏笔到哪了”，那么 `v2` 解决的就是：

> 系统不只知道这些状态，还知道这些状态为什么变、依据是什么、能不能稳定提交，并且能在真实模型写作风格下继续保持一致。

---

## 10. 建议的执行切分

如果你要进入实现阶段，我建议直接切成下面 4 组开发任务：

- Task A：review 结构化闭环建议与数据库迁移
- Task B：approve 结构化提交与正文 fallback 改造
- Task C：Hook / memory 规则升级
- Task D：CLI 展示与追溯增强

这样拆的好处是：

- 每组都能独立验证
- 每组都有清晰入口文件
- 不会一次性把 review、approve、schema、CLI 全部揉成一个大改动
