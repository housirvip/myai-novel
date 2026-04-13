# 召回与打分规则说明

## 目录

- [1. 文档目标](#1-文档目标)
- [2. 总结](#2-总结)
- [3. 相关代码位置](#3-相关代码位置)
- [4. Plan 阶段如何召回](#4-plan-阶段如何召回)
- [5. Draft 阶段是否重新召回](#5-draft-阶段是否重新召回)
- [6. 通用打分规则](#6-通用打分规则)
- [7. Reason 字段说明](#7-reason-字段说明)
- [8. 打分对照表](#8-打分对照表)
- [9. 各类实体的召回与打分规则](#9-各类实体的召回与打分规则)
- [10. 示例](#10-示例)
- [11. 风险提醒不是打分召回](#11-风险提醒不是打分召回)
- [12. 端到端 CLI 示例](#12-端到端-cli-示例)
- [13. 环境变量配置项](#13-环境变量配置项)
- [14. 一句话结论](#14-一句话结论)
- [相关阅读](#相关阅读)

## 1. 文档目标

本文只回答一个问题：当前系统里，`plan` 阶段的召回结果是如何命中的、如何打分排序的，以及为什么后续 `draft` 会继承这份召回结果。

如果你想看的是：

- 各阶段 prompt 如何串起来
- `review / repair / approve` 的 prompt 职责
- Provider 层如何附加 JSON 输出约束

请直接看：[`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)

## 2. 总结

当前系统的默认主链路不是正式向量检索，而是“规则式文本匹配 + 手工指定 ID + 业务加权”的优先度打分模型。

可以概括为：

- `plan`：执行召回，并按分数排序后截断
- `plan`：再把召回结果整理成 `hardConstraints / softReferences / riskReminders / priorityContext / recentChanges`
- `draft`：不重新召回，直接复用 `plan` 阶段保存下来的召回结果

所以：

- `plan` 有“召回规则”和“打分规则”
- `draft` 没有独立召回规则，只消费 `chapter_plans.retrieved_context`

## 3. 相关代码位置

- 召回实现：`src/domain/planning/retrieval-service.ts`
- 候选/重排接口：`src/domain/planning/retrieval-pipeline.ts`
- 共享特征层：`src/domain/planning/retrieval-features.ts`
- fact packet 构造：`src/domain/planning/fact-packet-builder.ts`
- relation 传播：`src/domain/planning/relation-propagation.ts`
- packet 合并：`src/domain/planning/fact-packet-merge.ts`
- `plan` 工作流：`src/domain/workflows/plan-chapter-workflow.ts`
- `draft` 工作流：`src/domain/workflows/draft-chapter-workflow.ts`
- 召回结构定义：`src/domain/planning/types.ts`

当前默认实现现在分两层：

- `RuleBasedCandidateProvider` 直接用现有规则式查询得到候选集
- 默认 `DirectPassThroughReranker` 不做额外二次重排，直接透传当前结果
- 可选 `HeuristicReranker` 可在显式配置下启用
- 可选 `EmbeddingCandidateProvider` 可在显式配置并注入 searcher 时补充语义候选

这层抽象的作用不是改变默认稳定行为，而是为后续实验预留稳定挂点：

- 可先接 embedding 候选召回源
- 再接业务层 rerank
- 同时保持当前 explainability 字段与工作流不需要重写

## 4. Plan 阶段如何召回

`plan` 阶段会分两步：

1. 先做一次初始召回  
   目的：给作者意图生成提供上下文
2. 再做一次关键词召回  
   目的：为最终章节规划生成强相关上下文

### 4.1 初始召回

第一次召回的输入：

- `keywords = []`
- `manualRefs = 用户命令行显式传入的实体 ID`

这一步通常只会稳定命中：

- 手工指定的人物、势力、物品、钩子、关系、世界设定
- 当前章节附近的大纲
- 最近章节摘要

### 4.2 关键词召回

系统会先得到 `authorIntent`，再从意图中提取：

- `intentSummary`
- `keywords`
- `mustInclude`
- `mustAvoid`

当前真正参与召回的是：

- `keywords`
- `manualRefs`

然后执行第二次召回，生成完整的 `retrievedContext`，保存到：

- `chapter_plans.retrieved_context`

## 5. Draft 阶段是否重新召回

不会。

`draft` 阶段直接读取当前 plan：

- `chapter.current_plan_id`

然后从 plan 中取出：

- `content`
- `retrieved_context`

这意味着：

- `draft` 不会重新按关键词检索数据库
- `draft` 不会重新排序实体
- `draft` 的事实边界以 `plan` 固化时的召回结果为准

这样做的好处是：

- 保证 `plan` 和 `draft` 用的是同一套上下文
- 避免同一章多次生成时召回结果来回漂移

## 6. 通用打分与优先级规则

当前大多数实体都走同一个基础公式。

### 6.1 基础分

如果某个实体被用户显式指定了 ID：

- `+100`

### 6.2 关键词命中分

对于每一个关键词，只要命中了该实体的任一匹配字段：

- `+25`

这里的命中逻辑不是复杂分词，而是：

- 把多个字段拼成一个文本串
- 转成小写
- 用 `includes(keyword)` 判断是否包含

### 6.3 保留条件

只有满足以下条件的实体才会进入最终结果：

- `score > 0`

也就是说，如果：

- 没有被手工指定
- 也没有命中任何关键词

那就不会被召回。

### 6.4 排序规则

实体召回完成后，统一按以下规则排序：

1. 分数降序
2. 分数相同按 `id` 升序
3. 最后按各实体类型的上限截断

在当前实现里，priority 与 rerank 的一些判断已经抽成共享特征层：

- `hasManualPriority()`
- `hasContinuityRisk()`
- `hasMotivationSignals()`
- `hasInstitutionContext()`
- `hasRuleIntent()`

这样 `priorityContext` 和 `HeuristicReranker` 不再各自维护一套相似规则。

## 7. Reason 字段说明

每个召回实体还会带一个 `reason` 字段，用于解释“为什么被召回”。

当前可能出现的原因包括：

- `manual_id`
- `keyword_hit`
- `chapter_proximity`
- `manual_entity_link`
- `low_relevance`

含义如下：

- `manual_id`：该实体是用户手动指定的
- `keyword_hit`：该实体文本命中了关键词
- `chapter_proximity`：主要用于钩子，说明与当前章节距离较近
- `manual_entity_link`：主要用于关系，说明它与手工指定的人物或势力存在连接
- `low_relevance`：没有明显命中原因，通常不会进入最终结果

## 8. 打分对照表

| 类型 | 是否走关键词打分 | 基础命中规则 | 额外加权 | 最终上限配置 |
| --- | --- | --- | --- | --- |
| 大纲 | 否 | 按章节范围筛选 | 无 | `PLANNING_RETRIEVAL_OUTLINE_LIMIT` |
| 最近章节 | 否 | 按章节号倒序筛选并要求存在摘要 | 无 | `PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT` |
| 人物 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 无 | `PLANNING_RETRIEVAL_CHARACTER_LIMIT` |
| 势力 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 无 | `PLANNING_RETRIEVAL_FACTION_LIMIT` |
| 物品 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 无 | `PLANNING_RETRIEVAL_ITEM_LIMIT` |
| 钩子 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 章节邻近加权，最高 `+40` | `PLANNING_RETRIEVAL_HOOK_LIMIT` |
| 关系 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 与手工指定人物/势力相连时 `+35` | `PLANNING_RETRIEVAL_RELATION_LIMIT` |
| 世界设定 | 是 | 手工 ID `+100`，每个关键词命中 `+25` | 无 | `PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT` |

补充说明：

- 所有走打分的实体，都只有在 `score > 0` 时才会进入最终结果
- 分数相同的情况下，按 `id` 升序排序
- 所有实体类查询都会先扫描一批候选，再按分数排序截断

## 9. 各类实体的召回与打分规则

### 9.1 大纲

大纲不是按关键词打分，而是按章节范围筛选。

命中条件：

- `chapter_start_no <= 当前章节 <= chapter_end_no`
- 或 `chapter_start_no is null`

输出上限：

- `PLANNING_RETRIEVAL_OUTLINE_LIMIT`

### 9.2 最近章节

最近章节也不是按关键词打分，而是按时间顺序筛选。

过滤条件：

- `chapter_no < 当前章节`
- `status != todo`

相关配置：

- `PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT`
- `PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`

### 9.3 人物

过滤条件：

- `status in [alive, missing, unknown]`

参与匹配的字段通常包括：

- `name`
- `alias`
- `personality`
- `background`
- `current_location`
- `goal`
- `keywords`
- 职业、等级、货币、能力等结构化字段

输出上限：

- `PLANNING_RETRIEVAL_CHARACTER_LIMIT`

### 9.4 势力

常见匹配字段包括：

- `name`
- `category`
- `core_goal`
- `description`
- `headquarter`
- `keywords`

输出上限：

- `PLANNING_RETRIEVAL_FACTION_LIMIT`

### 9.5 物品

常见匹配字段包括：

- `name`
- `category`
- `description`
- `rarity`
- `keywords`

输出上限：

- `PLANNING_RETRIEVAL_ITEM_LIMIT`

### 9.6 钩子

除了基础分和关键词命中外，还会考虑章节邻近性加权。

输出上限：

- `PLANNING_RETRIEVAL_HOOK_LIMIT`

### 9.7 关系

除了基础分和关键词命中外，还会考虑它是否与手工指定的人物或势力存在连接。

输出上限：

- `PLANNING_RETRIEVAL_RELATION_LIMIT`

### 9.8 世界设定

常见匹配字段包括：

- `title`
- `category`
- `content`
- `keywords`

输出上限：

- `PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT`

## 10. 示例

可以把一次典型召回理解为：

- 用户提供章节号和部分手工实体 ID
- 系统从作者意图中提取关键词
- 检索服务对候选实体打分排序
- 只把高相关结果写入 `retrievedContext`
- 后续 `draft / review / repair / approve` 复用这份结果

## 11. 风险提醒不是打分召回

需要特别区分：

- 召回结果：来自检索与打分
- 风险提醒：通常来自规划阶段的分析输出

两者都可能出现在 `plan` 阶段，但不是同一回事。

## 12. 端到端 CLI 示例

```bash
npm run dev -- plan \
  --book 1 \
  --chapter 12 \
  --provider mock \
  --authorIntent "本章要让主角借黑铁令撬开外门局势" \
  --characterIds 1,2 \
  --factionIds 1 \
  --relationIds 3 \
  --itemIds 1 \
  --hookIds 1,4 \
  --worldSettingIds 2,5 \
  --json
```

## 13. 环境变量配置项

召回相关上限主要由以下环境变量控制：

- `PLANNING_RETRIEVAL_OUTLINE_LIMIT`
- `PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT`
- `PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`
- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`
- `PLANNING_RETRIEVAL_CHARACTER_LIMIT`
- `PLANNING_RETRIEVAL_FACTION_LIMIT`
- `PLANNING_RETRIEVAL_ITEM_LIMIT`
- `PLANNING_RETRIEVAL_HOOK_LIMIT`
- `PLANNING_RETRIEVAL_RELATION_LIMIT`
- `PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT`
- `PLANNING_RETRIEVAL_RERANKER`
- `PLANNING_RETRIEVAL_EMBEDDING_ENABLED`
- `PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE`

其中新增实验项：

- `PLANNING_RETRIEVAL_RERANKER`
  - `none`
  - `heuristic`
- `PLANNING_RETRIEVAL_EMBEDDING_ENABLED`
  - `true / false`
- `PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE`
  - `basic`
  - `hybrid`

## 14. 一句话结论

如果只用一句话描述当前机制，可以写成：

`plan` 使用“关键词匹配驱动的优先度打分召回”，`draft` 不重新召回，而是直接继承 `plan` 固化下来的召回结果。

## 相关阅读

- [`README.md`](../README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
- [`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
