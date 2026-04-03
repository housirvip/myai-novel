# AI 自动写小说工具 v2 LLM Prompt 优化方案

## 1. 这份文档的目标

这份文档聚焦在当前 `planning`、`generation`、`review`、`rewrite` 四条 LLM 链路的 prompt 设计质量，回答三个问题：

1. 当前 prompt 是否够强
2. 写小说的必备要素是否已经完整进入模型输入
3. `v2` 应该如何系统升级 prompt 逻辑

相关实现文件：

- [`src/core/planning/service.ts`](src/core/planning/service.ts)
- [`src/core/generation/service.ts`](src/core/generation/service.ts)
- [`src/core/review/service.ts`](src/core/review/service.ts)
- [`src/core/rewrite/service.ts`](src/core/rewrite/service.ts)

---

## 2. 当前 prompt 结构现状

### 2.1 planning prompt

当前实现位于 [`src/core/planning/service.ts:42`](src/core/planning/service.ts:42)。

现状：

- `system` 很短，只规定“你是小说章节规划助手，只输出 JSON”
- `user` 直接把上下文 JSON 倾倒给模型
- 已包含：章节目标、planned beats、卷目标、主题、核心冲突、角色状态、Hook、记忆、关键物品

优点：

- 数据已经比一般 prompt 丰富很多
- 对结构化输出有明确要求
- 有 fallback plan 做安全兜底

问题：

- 缺少“什么叫好规划”的标准定义
- 缺少 scene 节奏约束、冲突递进约束、结尾牵引约束
- 缺少“必须承接上一章、必须推进主线、必须避免设定漂移”的显式优先级排序
- 没有给模型明确的 planning 方法论

结论：

- **当前可用，但更像上下文喂给模型后让它自行发挥**
- **对于写长篇，控制力还不够强**

---

### 2.2 generation prompt

当前实现位于 [`src/core/generation/service.ts:36`](src/core/generation/service.ts:36)。

现状：

- `system` 只有一句：你是小说写作助手，直接输出正文
- `user` 依然是原始 JSON
- 输入里包含章节目标、主题、角色状态、Hook、记忆、sceneCards、eventOutline、关键物品

优点：

- 数据侧输入不算少
- 结构化状态已经进了 prompt
- 可以让模型拿到规划结果再写正文

问题：

- 几乎没有定义“什么是好小说正文”
- 没要求视角稳定、语气统一、叙述密度、描写层次、情绪推进、节奏控制
- 没要求“展示而非解释”
- 没要求“每场景至少完成什么功能”
- 没要求“结尾必须留牵引”
- 没要求“不要把状态清单生硬写进正文”

结论：

- **这是当前最需要强化的一条 prompt**
- 输入数据够了，但“创作规则”明显不够

---

### 2.3 review prompt

当前实现位于 [`src/core/review/service.ts:309`](src/core/review/service.ts:309)。

现状：

- `system` 只规定输出 JSON 和字段名
- `user` 输入只有：objective、eventOutline、wordCountCheck、draft

优点：

- 输出结构明确
- 审查结果字段较全

问题：

- 没显式输入角色状态、物品状态、Hook 状态、长期记忆事实
- 这些更多依赖后续规则 merge，而不是让模型直接基于完整真源审查
- 没要求模型区分“文本质量问题”和“状态一致性问题”
- 没要求输出“高优先级问题”和“必须重写原因”
- 没要求输出可被 approve 消费的结构化闭环建议

结论：

- **当前 review 更像一个 JSON 问题生成器**
- **还不是一个强一致性审查器**

---

### 2.4 rewrite prompt

当前实现位于 [`src/core/rewrite/service.ts:71`](src/core/rewrite/service.ts:71)。

现状：

- `system` 只有一句：你是小说重写助手，输出重写后的章节文本
- `user` 只有 draft、revisionAdvice、goals

优点：

- 很直接
- 重写目标可以传入

问题：

- 没把章节目标、主题、scene plan、Hook、物品、记忆重新带进去
- 模型只能依赖旧 draft 和 review 建议，容易重写后偏离原始 planning 目标
- 没要求“保留既有事实，不得推翻状态真源”
- 没要求“优先修复哪些问题，哪些事实绝对不能动”

结论：

- **这是目前信息损失最大的一条链路**
- **重写非常容易变成局部润色，而不是面向主链路的纠偏**

---

## 3. 写小说的必备要素，当前是否覆盖完整

如果以“长篇章节生成”角度看，模型至少应该稳定拿到下面几类要素。

### 3.1 当前已经部分覆盖的要素

- 章节目标
- 卷目标
- 主题
- 核心冲突
- 上一章承接
- 角色状态
- 关键物品状态
- 活跃 Hook
- 记忆系统
- scene plan
- event outline

这些在 [`src/core/planning/service.ts`](src/core/planning/service.ts) 和 [`src/core/generation/service.ts`](src/core/generation/service.ts) 里基本都已经进入了输入。

### 3.2 当前缺失或明显不够强的要素

#### A. 叙事约束

当前没有明确要求：

- 叙事视角稳定
- 人称稳定
- 时态稳定
- 语气 / 文风稳定
- 章节内不跳戏、不像提纲、不像说明文

#### B. 场景推进规则

当前没有明确要求：

- 每个 scene 需要完成什么叙事职责
- 场景之间要怎样递进冲突和信息量
- 哪些信息应通过动作 / 对话 / 环境展现，而不是直接说明

#### C. 情绪与人物弧线

当前没有显式要求：

- 主角情绪变化弧线
- 本章人物关系推进点
- 人物决定的心理因果链

#### D. 小说语言质量标准

当前没有要求：

- 避免空泛总结句
- 避免模板化结尾
- 避免全篇只有事件摘要，没有具体场面
- 控制 exposition 与 dramatization 的比例

#### E. 结尾钩子标准

虽然系统里有 Hook，但 generation prompt 没明确要求：

- 结尾必须留下新的局势变化
- 结尾必须具有下一章牵引力
- 结尾不能只是泛泛而谈的总结

#### F. 重写保真约束

rewrite 目前缺少明确约束：

- 不得篡改既有事实
- 不得改坏 Hook 承接
- 不得消解章节目标
- 不得让关键物品状态失真

结论：

- **状态信息基本够了**
- **小说创作规则明显不够**
- **当前短板不是“缺字段”，而是“缺写作方法和质量约束”**

---

## 4. v2 Prompt 优化总策略

`v2` 不应该继续只做“把更多 JSON 扔给模型”，而应该升级成：

1. 更强的 `system` 规则
2. 更分层的 `user` 输入组织
3. 更明确的输出标准
4. 更强的失败兜底与解析约束

### 4.1 system prompt 从“角色定义”升级为“角色 + 任务 + 质量标准 + 禁止事项”

每条链路的 `system` 都应至少包含：

- 你是什么助手
- 你本轮任务是什么
- 你必须优先满足什么约束
- 你不能做什么
- 你输出必须符合什么格式

### 4.2 user prompt 从“扔 JSON”升级为“结构化任务包”

建议把输入分块，而不是直接裸 JSON：

- 任务目标
- 不可违反的真源状态
- 章节上下文
- 结构规划
- 质量要求
- 输出要求

### 4.3 明确区分“创作质量约束”和“状态一致性约束”

这是当前最缺的。

模型需要同时知道：

- 怎么把这一章写得像小说
- 怎么不破坏状态闭环

### 4.4 明确区分“必须项”和“可选项”

例如：

- 必须承接上一章局势
- 必须呼应章节目标
- 必须推进至少一条核心冲突
- 必须体现至少一个具体场景
- 必须让结尾有下一章牵引
- 可选地增加环境描写或支线张力

---

## 5. 分链路优化建议

## P1：planning prompt 优化

### 建议新增的 system 约束

- 你不是在写正文，而是在制定小说章节作战方案
- scene 设计必须服务于冲突推进，而不是平均分配信息
- 必须承接上一章状态
- 必须推进至少一条核心冲突或 Hook
- 必须给出结尾局势变化
- statePredictions 必须具体到角色 / 物品 / Hook / 记忆层面

### 建议新增的 user 分块

- 章节任务定义
- 当前真源状态摘要
- 上一章遗留问题
- 关键角色 / 关键物品 / 活跃 Hook
- 长期记忆约束
- 输出字段说明

### planning 输出建议补强

建议在 [`src/shared/types/domain.ts`](src/shared/types/domain.ts) 的 `ChapterPlan` 后续增加或强化：

- `endingDrive`
- `mustKeepFacts`
- `forbiddenContradictions`
- `scenePurposeChecklist`

---

## P2：generation prompt 优化

### 建议新增的 system 约束

- 写的是小说正文，不是提纲，不是总结，不是说明书
- 以场景、动作、对话、感官细节来推进
- 避免空泛总结和抽象概述堆砌
- 保持叙事视角一致
- 必须承接关键状态，但不要生硬罗列状态表
- 结尾必须形成下一章牵引

### generation 必须补上的小说要素

- 视角约束
- 章节情绪曲线
- 场景层次
- 节奏变化
- 环境描写
- 人物动作与心理链路
- 结尾钩子标准

### 建议新增的 user 分块

- 本章创作目标
- 不得违背的状态真源
- 场景卡与事件大纲
- 人物关系重点
- 必须推进的 Hook
- 必须自然出现的关键物品
- 本章语言与节奏要求

### generation 关键改进结论

`v2` 最值得优先优化的 prompt 是 [`src/core/generation/service.ts`](src/core/generation/service.ts)。

---

## P3：review prompt 优化

### 建议新增的 system 约束

- 你不是泛泛评价文本，而是在做小说章节审查
- 要区分：硬错误、软问题、可优化项
- 必须优先识别状态闭环风险
- 必须给出可执行修订建议
- 最终要产出可被 approve 消费的结构化闭环建议

### review user 输入应补足

- 角色当前状态
- 关键物品当前状态
- 活跃 Hook 状态
- 长期记忆高优先事实
- sceneCards
- 章节计划中的 `statePredictions`

### review 输出建议新增

- `mustFixIssues`
- `qualityIssues`
- `closureSuggestions`
- `approvalRisk`

这样 review 才能从“报告器”升级成“闭环控制器”。

---

## P4：rewrite prompt 优化

### 当前最大问题

rewrite 没重新带 planning / 状态 / Hook / 记忆上下文。

### 建议新增的 system 约束

- 本轮不是自由重写，而是定向修复
- 必须保留既有事实和状态真源
- 必须优先修复审查指出的高优问题
- 不得把正文重写成摘要或解释文

### rewrite user 输入应补足

- 原始章节目标
- 主题
- sceneCards
- eventOutline
- 角色 / 物品 / Hook / 记忆约束
- review 的问题分级结果
- 本轮必须保留事实

### rewrite 输出目标

- 修复关键问题
- 保留正文完整性
- 不损伤前后章连接关系

---

## 6. 推荐实施顺序

如果要进入实现，最推荐按下面顺序做：

1. 优化 generation prompt
2. 优化 review prompt
3. 优化 rewrite prompt
4. 最后优化 planning prompt

原因：

- generation 直接决定正文质量，是最明显短板
- review 决定你能不能稳住闭环
- rewrite 决定审查建议能不能真正转化成更好的正文
- planning 虽然也值得改，但当前它已经比 generation 和 rewrite 更稳

---

## 7. v2 验收标准

以下全部满足，才算 prompt 逻辑达到 `v2` 要求：

1. planning 能稳定产出更具冲突递进和结尾牵引的章节方案
2. generation 正文不再明显像提纲、总结或状态清单
3. review 不只指出问题，还能给出结构化闭环建议
4. rewrite 能在不破坏事实的前提下稳定修复字数、节奏和一致性问题
5. 真实模型模式下，生成文本的小说感、承接感、结尾牵引力明显提升

---

## 8. 一句话总结

当前 LLM 逻辑的问题不是“没有上下文”，而是：

> 已经有了很多上下文，但还没有足够强的小说写作规则、审查方法论和重写保真约束。

因此 `v2` 的 prompt 优化重点不是继续塞更多字段，而是把“小说创作标准 + 状态闭环标准 + 输出协议”三件事一起写清楚。 
