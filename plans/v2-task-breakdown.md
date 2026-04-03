# AI 自动写小说工具 v2 模块级任务拆解

## 1. 这份文档的用途

- 这份文档是 [`plans/v2-strong-closure-plan.md`](plans/v2-strong-closure-plan.md) 的执行层拆解版本
- 目标不是再解释 `v2` 的设计原则，而是回答“接下来具体先写什么文件、做什么模块、按什么顺序推进”
- 适合直接拿来排开发任务，也适合在实现时作为阶段验收清单

## 2. v2 的总执行策略

`v2` 的核心不是再增加更多工作流命令，而是把 `v1` 已有的“状态闭环”从**正文辅助闭环**推进成**结构化事实闭环**。

`v2` 不是只改 `approve`，而是要让 `planning / writing / review / rewrite / approve` 五段开始共享统一状态语义：

- planning 提出状态目标与约束
- writing 产出正文事实
- review 产出结构化闭环建议
- rewrite 在不破坏结构化事实的前提下修正文稿
- approve 提交结构化结果并落追溯日志

因此执行顺序必须是：

1. 先建立统一的结构化闭环协议
2. 再让 `review` 能稳定产出结构化闭环建议
3. 再让 `rewrite` 和 `approve` 共同消费这套统一状态语义
4. 最后再升级 Hook、memory 与 trace 的可解释性

如果反过来做，会出现：

- 表加了但没有统一闭环载荷可写
- review 还是只能报问题，不能交状态
- rewrite 仍只改文风和节奏，不能稳定保留结构化事实
- approve 还是依赖正文结构化片段兜底
- Hook 和 memory 升级后仍然挂靠旧路径，效果不稳

## 3. v2 模块总览

`v2` 建议优先新增或强化的模块：

- `src/shared/types/domain`
- `src/core/review`
- `src/core/rewrite`
- `src/core/approve`
- `src/core/context`
- `src/infra/db/schema`
- `src/infra/repository/chapter-review`
- `src/infra/repository/chapter-rewrite`
- `src/infra/repository/memory`
- `src/infra/repository/chapter-state-update`
- `src/infra/repository/chapter-hook-update`
- `src/infra/repository/chapter-memory-update`
- `src/cli/commands/workflow-commands`
- `src/cli/commands/state-commands`

## 4. 里程碑拆解

## M1：review 结构化闭环协议落地

### M1 目标

先解决 `v2` 最核心的一层协议问题：

- review 不再只输出问题列表
- review 开始输出可被 approve 消费的结构化闭环建议

### M1 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

新增或补强：

- `ClosureSuggestions`
- `CharacterStateClosureSuggestion`
- `ItemStateClosureSuggestion`
- `HookStateClosureSuggestion`
- `MemoryClosureSuggestion`
- `ReviewReport` 增加 `closureSuggestions`

完成定义：

- review 的结构化结果不再只是零散字段，而是统一协议对象
- 每条建议都能表达“更新谁、更新成什么、为什么更新、依据是什么”
- memory 类建议能够区分长期事实、短期事件、观察态事实

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

补强数据表：

- `chapter_reviews` 新增 `closure_suggestions_json`

完成定义：

- review 的结构化闭环建议可以完整落库
- 不需要在 approve 阶段重新从正文反推一遍建议

#### C. [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts)

交付件：

- create 时写入 `closureSuggestions`
- getLatestByChapterId 时读出 `closureSuggestions`
- getById 时读出 `closureSuggestions`（如果已有）

完成定义：

- review repository 可以完整承载 `review -> approve` 的主通道数据

#### D. [`src/core/review/service.ts`](src/core/review/service.ts)

补强：

- 在现有 issue 检查后，增加结构化闭环建议生成阶段
- 即使 LLM 不稳定，也要有规则式兜底建议
- 将角色 / 物品 / Hook / 记忆闭环建议整合进最终 review 结果

完成定义：

- review 不只是“发现问题”，而是开始“形成提交建议”
- rewrite 后续可以消费 review 产物，而不是只消费 revision advice
- approve 后续可以直接消费 review 产物，而不是重新猜正文

#### E. [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts)

补强：

- rewrite 消费 review 产出的结构化闭环建议，而不只是消费 revision advice
- rewrite 在优化节奏、表达和结尾牵引时，不能破坏已确认的结构化事实
- 如有需要，可显式输出“已保留事实摘要”供 approve 或调试使用

完成定义：

- rewrite 不再只是文稿润色阶段，而是闭环协议中的事实保留阶段
- review / rewrite / approve 三段开始共享统一状态语义

#### F. [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts)

补强：

- `review show` 增加结构化闭环建议展示

完成定义：

- 用户可以直接检查 review 给出的结构化建议是否合理
- 调试时能明确看到 review 认为本章确认了哪些事实

### M1 验收

- 每次 review 至少可以输出角色 / 物品 / Hook / 记忆中的一类结构化建议
- `review show` 可以直接查看这些建议
- rewrite 阶段开始具备消费结构化建议的输入条件
- 即使模型输出不稳定，规则式路径也能给出最小可用建议

---

## M2：approve 优先消费结构化建议

### M2 目标

把 `approve` 从“正文解析主导”切换成“结构化建议主导”，同时让 `rewrite` 和 `approve` 共享同一套闭环语义。

#### A. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 优先读取最近一次 review 的 `closureSuggestions`
- 将角色、物品、Hook、memory 的提交逻辑拆成独立 apply 阶段
- 正文解析逻辑从主路径降级为 fallback

完成定义：

- `approve` 可以在自然正文场景下仍稳定提交状态
- 状态提交的主依据从正文格式片段切换为结构化闭环建议

#### B. [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts)

补强：

- rewrite 显式读取 review 的 `closureSuggestions`
- rewrite 在重写时优先保持已确认事实、状态边界和 Hook 处理结果
- rewrite 的输出若与 closure suggestions 冲突，必须在 review / approve 前被再次发现

完成定义：

- rewrite 不会因为节奏优化或语言重写而破坏结构化闭环
- `review -> rewrite -> approve` 三段的状态语义保持一致

#### C. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补强：

- `ChapterStateUpdate`
- `ChapterHookUpdate`
- `ChapterMemoryUpdate`

新增建议字段：

- `reason`
- `evidenceSummary`
- `source`
- `previousValueSummary`
- `nextValueSummary`

完成定义：

- 状态更新日志不再只是结果摘要，而带有变更依据和来源说明
- 每次状态更新都能回答“更新了谁、为什么更新、依据来自哪里、与上一状态相比变了什么”

#### D. [`src/infra/repository/chapter-state-update-repository.ts`](src/infra/repository/chapter-state-update-repository.ts)

补强：

- 写入和读取上述增强字段

#### E. [`src/infra/repository/chapter-hook-update-repository.ts`](src/infra/repository/chapter-hook-update-repository.ts)

补强：

- 写入和读取 Hook 更新依据字段

#### F. [`src/infra/repository/chapter-memory-update-repository.ts`](src/infra/repository/chapter-memory-update-repository.ts)

补强：

- 写入和读取 memory 更新依据字段

### M2 验收

- 模型输出完全自然正文时，角色和物品状态仍然能稳定提交
- rewrite 后的正文不会破坏 review 已确认的结构化事实
- `approve` 只有在 review 缺失结构化建议时才会退回正文解析
- 更新日志能看出“本次更新来自 review 建议还是正文 fallback”
- 每次关键状态更新都必须显式记录变更前摘要、变更后摘要、变更原因和依据摘要
- 对角色 / 物品 / Hook / memory 的关键提交，必须能够回答“更新了谁、为什么更新、依据来自哪里、与上一状态相比变了什么”

---

## M3：Hook 事实驱动提交

### M3 目标

让 Hook 更新不再只是根据 `hookPlan` 的动作推导，而是根据“计划 + 正文事实 + 审查建议”联合判断。

### M3 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补强：

- `HookStateClosureSuggestion` 的状态表达
- `HookCurrentState` 的必要字段

建议字段至少包括：

- `hookId`
- `actualOutcome`
- `nextStatus`
- `reason`
- `evidence`
- `confidence`

完成定义：

- Hook 建议可以表达“计划推进但正文未承接”“已承接但未 payoff”“已完成回收”等不同事实状态

#### B. [`src/core/review/service.ts`](src/core/review/service.ts)

补强：

- review 输出本章 Hook 的实际处理结果判断
- 区分计划动作与事实动作

完成定义：

- review 能明确判断本章 Hook 是 hold、foreshadow、advance 还是 payoff
- 这份判断可以直接交给 approve 使用

#### C. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- Hook 更新优先消费 `HookStateClosureSuggestion`
- `hookPlan` 只作为参考，不再直接主导状态推进

完成定义：

- Hook 状态推进从“计划驱动”升级到“事实驱动”

#### D. [`src/infra/repository/hook-state-repository.ts`](src/infra/repository/hook-state-repository.ts)

补强：

- 若有需要，补 batch upsert 或更清晰的状态读取接口

完成定义：

- approve 可以更稳定地批量提交 Hook 更新

### M3 验收

- Hook 状态不再主要靠 `transitionHookStatus(hookPlan.action)` 直接推进
- review 可以区分“计划推进但正文未承接”和“正文已实际推进”
- `state-updates show` 或相关 trace 能解释 Hook 为什么变成当前状态

---

## M4：记忆闭环升级

### M4 目标

把当前 memory 从“摘要集合”升级为“分层事实集合”，同时让 recall 与冲突判断更稳。

### M4 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补强：

- `LongTermMemoryEntry`
- `MemoryRecallView`
- `MemoryClosureSuggestion`

建议新增区分：

- 长期稳定事实
- 短期事件
- 待观察事实

完成定义：

- memory 不再只是 `summary + importance`，而能表达事实层级和用途边界

#### B. [`src/infra/repository/memory-repository.ts`](src/infra/repository/memory-repository.ts)

补强：

- recallRelevantLongTermEntries 的排序策略
- 长短期 memory 的分层读写
- 新事实和观察态事实的写入接口

完成定义：

- planning / writing 拿到的 recall 更贴近本章任务
- approve 沉淀 memory 时不再只有一个扁平列表

#### C. [`src/core/context/planning-context-builder.ts`](src/core/context/planning-context-builder.ts)

补强：

- 使用 chapter title、objective、planned beats、活跃 Hook、关键物品联合召回长期记忆

完成定义：

- planning 的 memory 输入更稳定，不会只靠关键词命中

#### D. [`src/core/context/writing-context-builder.ts`](src/core/context/writing-context-builder.ts)

补强：

- 写作上下文沿用增强后的 recall 结果
- 必要时可区分“必须遵守事实”和“仅供参考背景”

完成定义：

- 正文生成时对长期事实和短期事件的优先级更清晰

#### E. [`src/core/review/service.ts`](src/core/review/service.ts)

补强：

- 输出 memory closure 建议
- 明确哪些事实应进入长期记忆，哪些只保留短期窗口，哪些应继续观察

#### F. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 依据 memory closure suggestions 提交短期 / 长期 / 观察态结果

### M4 验收

- planning / writing 能拿到更稳定的长期记忆召回结果
- review 能更明确地区分“确认事实”和“候选事实”
- rewrite 不会因为重写表达而推翻已确认的记忆边界
- 对进入长期记忆的事实，必须能说明它为何被确认，而不是只给出摘要文本
- 对仅保留短期窗口或观察态的事实，必须能说明为什么暂不进入长期真源
- approve 对 memory 的沉淀不再只依赖 `newFactCandidates`

---

## M5：追溯与调试增强

### M5 目标

让状态问题不只是“看最终结果”，而是能倒推到 review 建议、approve 决策和最终状态更新。

### M5 模块任务

#### A. [`src/shared/types/domain.ts`](src/shared/types/domain.ts)

补强：

- 状态更新日志相关类型的 trace 字段

#### B. [`src/infra/db/schema.ts`](src/infra/db/schema.ts)

补强：

- `chapter_state_updates`
- `chapter_hook_updates`
- `chapter_memory_updates`

按需要增加：

- `reason`
- `evidence_summary`
- `source`
- `previous_value_summary`
- `next_value_summary`

完成定义：

- trace 数据能完整落库，而不是只保留一句 summary

#### C. [`src/core/approve/service.ts`](src/core/approve/service.ts)

补强：

- 每次提交状态时同时记录来源、原因、依据摘要、变更前后摘要

完成定义：

- approve 真正成为“统一提交入口 + 统一追溯入口”

#### D. [`src/cli/commands/state-commands.ts`](src/cli/commands/state-commands.ts)

补强：

- `state-updates show` 展示更完整的依据摘要
- 如有必要，增加更适合排查的 trace 视图

#### E. [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts)

补强：

- review / approve 的展示信息更容易串联

### M5 验收

- 某个状态异常时，可以定位到是哪次 review 建议和哪次 approve 决策引入的
- trace 信息足够支持长线一致性排错
- 用户不需要翻正文，也能理解这次状态变化为什么发生

## 5. 每阶段执行顺序

### 第一阶段：先打 M1

顺序：

1. `domain.ts` 补 `closureSuggestions` 相关类型
2. `chapter_reviews` 表增加 `closure_suggestions_json`
3. `chapter-review-repository` 读写闭环建议
4. `ReviewService` 产出结构化闭环建议
5. `review show` 展示闭环建议

### 第二阶段：做 M2

顺序：

1. `ApproveService` 拆分结构化提交阶段
2. `RewriteService` 接入 `closureSuggestions`，保证重写不破坏已确认事实
3. 角色 / 物品 / Hook / memory 分别改为优先消费 review 建议
4. 旧正文解析逻辑降级为 fallback
5. update repositories 与日志类型补 reason / evidence / source

### 第三阶段：做 M3

顺序：

1. Hook suggestion 类型补强
2. review 增加 Hook 事实判断
3. rewrite 接入 Hook 相关闭环建议，避免重写破坏事实推进
4. approve 改成事实驱动提交 Hook
5. hook update trace 补强

### 第四阶段：做 M4

顺序：

1. memory 类型升级
2. memory repository 升级 recall 与分层写入
3. context builder 接入增强 recall
4. review 增加 memory closure suggestions
5. approve 使用新的 memory 提交路径

### 第五阶段：做 M5

顺序：

1. schema 增强 trace 字段
2. approve 写入更完整的更新依据
3. state commands 展示 trace
4. workflow commands 串联 review / approve / trace

## 6. 推荐你下一步直接开工的任务

如果下一轮进入 coding，我建议从下面 8 个任务开始：

1. 在 [`src/shared/types/domain.ts`](src/shared/types/domain.ts) 增加 `ClosureSuggestions` 及四类 suggestion 类型
2. 在 [`src/shared/types/domain.ts`](src/shared/types/domain.ts) 给 `ReviewReport` 增加 `closureSuggestions`
3. 在 [`src/infra/db/schema.ts`](src/infra/db/schema.ts) 给 `chapter_reviews` 增加 `closure_suggestions_json`
4. 升级 [`src/infra/repository/chapter-review-repository.ts`](src/infra/repository/chapter-review-repository.ts)
5. 升级 [`src/core/review/service.ts`](src/core/review/service.ts)
6. 升级 [`src/cli/commands/workflow-commands.ts`](src/cli/commands/workflow-commands.ts)
7. 升级 [`src/core/approve/service.ts`](src/core/approve/service.ts)
8. 升级 [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts)
9. 升级状态更新相关 repository 与 show 命令

## 7. 一句话总纲

`v2` 的开发顺序不是“先继续增强写作正文”，而是：

> 先让系统稳定地产出、提交、追溯结构化事实，再让模型在这些事实约束下继续写。
