# 召回与打分规则说明

本文说明当前系统中 `plan` 与 `draft` 阶段使用的召回策略、打分规则、排序规则，以及各类实体的匹配字段。

## 1. 总结

当前系统的召回不是向量检索，而是“规则式文本匹配 + 手工指定 ID + 业务加权”的优先度打分模型。

可以概括为：

- `plan`：执行召回，并按分数排序后截断
- `draft`：不重新召回，直接复用 `plan` 阶段保存下来的召回结果

所以：

- `plan` 有“召回规则”和“打分规则”
- `draft` 没有独立召回规则，只消费 `chapter_plans.retrieved_context`

## 2. 相关代码位置

- 召回实现：`src/domain/planning/retrieval-service.ts`
- `plan` 工作流：`src/domain/workflows/plan-chapter-workflow.ts`
- `draft` 工作流：`src/domain/workflows/draft-chapter-workflow.ts`
- 召回结构定义：`src/domain/planning/types.ts`

## 3. Plan 阶段如何召回

`plan` 阶段会分两步：

1. 先做一次初始召回  
   目的：给“作者意图生成”提供上下文

2. 再做一次关键词召回  
   目的：为最终章节规划生成强相关上下文

### 3.1 初始召回

第一次召回的输入：

- `keywords = []`
- `manualRefs = 用户命令行显式传入的实体 ID`

这一步通常只会稳定命中：

- 手工指定的人物、势力、物品、钩子、关系、世界设定
- 当前章节附近的大纲
- 最近章节摘要

### 3.2 关键词召回

系统会先得到 `authorIntent`，再让模型从意图中提取：

- `intentSummary`
- `keywords`
- `mustInclude`
- `mustAvoid`

当前真正参与召回的是：

- `keywords`
- `manualRefs`

然后执行第二次召回，生成完整的 `retrievedContext`，保存到：

- `chapter_plans.retrieved_context`

后续 `draft / review / repair / approve` 都会复用它。

## 4. Draft 阶段是否重新召回

不会。

`draft` 阶段直接读取当前 plan：

- `chapter.current_plan_id`

然后从 plan 中取出：

- `content`
- `retrieved_context`

再一起送入 `buildDraftPrompt()`。

这意味着：

- `draft` 不会重新按关键词检索数据库
- `draft` 不会重新排序实体
- `draft` 的事实边界以 `plan` 固化时的召回结果为准

这样做的好处是：

- 保证 `plan` 和 `draft` 用的是同一套上下文
- 避免同一章多次生成时召回结果来回漂移

## 5. 通用打分规则

当前大多数实体都走同一个基础公式。

### 5.1 基础分

如果某个实体被用户显式指定了 ID：

- `+100`

### 5.2 关键词命中分

对于每一个关键词，只要命中了该实体的任一匹配字段：

- `+25`

这里的命中逻辑不是复杂分词，而是：

- 把多个字段拼成一个文本串
- 转成小写
- 用 `includes(keyword)` 判断是否包含

### 5.3 保留条件

只有满足以下条件的实体才会进入最终结果：

- `score > 0`

也就是说，如果：

- 没有被手工指定
- 也没有命中任何关键词

那就不会被召回。

### 5.4 排序规则

实体召回完成后，统一按以下规则排序：

1. 分数降序
2. 分数相同按 `id` 升序
3. 最后按各实体类型的上限截断

## 6. Reason 字段说明

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
- `manual_entity_link`：主要用于关系，说明它与手动指定的人物或势力存在连接
- `low_relevance`：没有明显命中原因，通常不会进入最终结果，因为分数一般不会大于 0

## 7. 打分对照表

下表用于快速查看各类对象的召回方式、匹配字段和额外加权。

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

- 所有走打分的实体，都只有在 `score > 0` 时才会进入最终结果。
- 分数相同的情况下，按 `id` 升序排序。
- 所有实体类查询都会先从数据库扫描一批候选，再按分数排序截断；扫描池大小由 `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT` 控制。

## 8. 各类实体的召回与打分规则

## 8.1 大纲

大纲不是按关键词打分，而是按章节范围筛选。

命中条件：

- `chapter_start_no <= 当前章节 <= chapter_end_no`
- 或 `chapter_start_no is null`

输出上限：

- 由 `PLANNING_RETRIEVAL_OUTLINE_LIMIT` 控制

返回内容通常包含：

- `title`
- `story_core`
- `main_plot`
- `sub_plot`
- `foreshadowing`
- `expected_payoff`

## 8.2 最近章节

最近章节也不是按关键词打分，而是按时间顺序筛选。

过滤条件：

- `chapter_no < 当前章节`
- `status != todo`

处理方式：

1. 先按章节号倒序取一批候选章节
2. 尝试从 `chapter.summary / current_final.summary / current_draft.summary / current_plan.author_intent` 中找摘要
3. 过滤掉没有有效摘要的章节
4. 只保留最近若干章

相关配置：

- 最终返回上限：`PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT`
- 候选扫描倍率：`PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`

## 8.3 人物

过滤条件：

- `status in [alive, missing, unknown]`

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_CHARACTER_LIMIT`

参与匹配的字段：

- `name`
- `alias`
- `background`
- `current_location`
- `personality`
- `professions`
- `levels`
- `currencies`
- `abilities`
- `goal`
- `append_notes`
- `keywords`

打分方式：

- 手工 ID 命中：`+100`
- 每个关键词命中：`+25`

## 8.4 势力

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_FACTION_LIMIT`

参与匹配的字段：

- `name`
- `category`
- `core_goal`
- `append_notes`
- `keywords`

打分方式：

- 手工 ID 命中：`+100`
- 每个关键词命中：`+25`

## 8.5 物品

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_ITEM_LIMIT`

参与匹配的字段：

- `name`
- `description`
- `append_notes`
- `keywords`

打分方式：

- 手工 ID 命中：`+100`
- 每个关键词命中：`+25`

## 8.6 钩子

过滤条件：

- `status in [open, progressing]`

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_HOOK_LIMIT`

参与匹配的字段：

- `title`
- `description`
- `append_notes`
- `keywords`

基础打分：

- 手工 ID 命中：`+100`
- 每个关键词命中：`+25`

额外业务加权：

- `target_chapter_no == 当前章节`：`+40`
- 与当前章节相差 1 章：`+25`
- 与当前章节相差 2 章：`+10`

这一类加权的目的是：

- 即使关键词不够强，临近应回收的钩子也更容易被排到前面

## 8.7 关系

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_RELATION_LIMIT`

关系召回有一个额外步骤：

- 会先解析关系两端的实体名称
- 把 `source_type/source_id`、`target_type/target_id` 转成更可读的名字

参与匹配的字段：

- 起点实体名
- 终点实体名
- `relation_type`
- `description`
- `append_notes`
- `keywords`

基础打分：

- 手工指定关系 ID：`+100`
- 每个关键词命中：`+25`

额外业务加权：

- 如果该关系连接到了手工指定的人物或势力：`+35`

这一类加权的目的是：

- 当用户明确指定了某个人物或势力时，与其直接相关的关系更容易被召回

## 8.8 世界设定

过滤条件：

- `status = active`

候选扫描上限：

- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

最终返回上限：

- `PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT`

参与匹配的字段：

- `title`
- `category`
- `content`
- `append_notes`
- `keywords`

打分方式：

- 手工 ID 命中：`+100`
- 每个关键词命中：`+25`

## 9. 示例

下面用几组简化示例说明当前打分是怎么生效的。

### 9.1 人物召回示例

假设当前：

- 作者意图提取关键词：`["林夜", "黑铁令", "感知增强"]`
- 用户没有手工指定人物 ID

数据库中有一条人物记录：

- `name = 林夜`
- `abilities = 感知增强,危机预判`
- `append_notes = 第2章起开始追查黑铁令来源`

则该人物的打分大致为：

- 命中关键词 `林夜`：`+25`
- 命中关键词 `黑铁令`：`+25`
- 命中关键词 `感知增强`：`+25`
- 手工 ID 未命中：`+0`

最终分数：

- `75`

对应 reason 可能为：

- `keyword_hit`

如果此时用户又显式指定了 `--characterIds 12`，且该人物的 ID 正好为 `12`，则分数会变成：

- 手工 ID：`+100`
- 三个关键词命中：`+75`
- 合计：`175`

对应 reason 可能为：

- `manual_id+keyword_hit`

### 9.2 钩子召回示例

假设当前章节是第 `10` 章，关键词为：

- `["旧案", "黑铁令"]`

数据库中有一条钩子：

- `title = 黑铁令与宗门旧案`
- `description = 黑铁令可能与宗门旧案相关`
- `target_chapter_no = 10`
- 用户没有手工指定该钩子 ID

则该钩子的打分大致为：

- 命中关键词 `旧案`：`+25`
- 命中关键词 `黑铁令`：`+25`
- 目标章节就是当前章节：`+40`

最终分数：

- `90`

对应 reason 可能为：

- `chapter_proximity+keyword_hit`

如果它的 `target_chapter_no = 9`，则邻近加权会变成：

- `+25`

总分就会变成：

- `50` 或 `75`，取决于命中了几个关键词

### 9.3 关系召回示例

假设用户执行 `plan` 时显式指定：

- `--characterIds 12`

而数据库中存在关系：

- `source = 林夜 (character:12)`
- `target = 青岳宗 (faction:7)`
- `relation_type = member`
- `description = 林夜正式以外门弟子身份进入青岳宗`

即使本次关键词没有命中这条关系，只要它连接到了手工指定人物 `12`，也会额外得到：

- `manual_entity_link = +35`

如果再加上关键词：

- `["青岳宗", "外门"]`

那还会继续得到：

- 命中 `青岳宗`：`+25`
- 命中 `外门`：`+25`

最终分数可能是：

- `85`

对应 reason 可能为：

- `manual_entity_link+keyword_hit`

### 9.4 Draft 复用 Plan 召回结果示例

假设第 8 章执行 `plan` 时，最终召回到了：

- 人物：林夜、顾沉舟
- 势力：青岳宗
- 物品：黑铁令
- 钩子：黑铁令与宗门旧案
- 世界设定：宗门等级制度

这些内容会整体写入：

- `chapter_plans.retrieved_context`

之后执行第 8 章 `draft` 时，系统不会重新按关键词去数据库里找一遍，而是直接取这份 `retrieved_context` 喂给模型。

这意味着：

- 即使数据库在 `plan` 与 `draft` 之间新增了别的人物
- 只要没有重新执行 `plan`
- 那么 `draft` 仍然使用旧的召回结果

这样做的意义是：

- 保证同一章的规划与写作使用同一套事实边界
- 避免同一章在不同阶段使用不同上下文，导致内容漂移

## 10. 风险提醒不是打分召回

`riskReminders` 不是独立检索出来的实体，而是系统根据召回结果自动总结出来的提醒。

当前会在以下场景生成提醒：

- 命中接近当前章节的钩子：提醒避免遗漏推进
- 命中最近章节：提醒承接前文状态与人物位置
- 命中世界设定：提醒不要违反世界规则、职业体系、货币体系

所以它更像“召回后的派生结果”，不是单独参与排序的对象。

## 11. 环境变量配置项

当前上限类值已支持环境变量配置，相关项包括：

- `PLANNING_RETRIEVAL_OUTLINE_LIMIT`
- `PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT`
- `PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER`
- `PLANNING_RETRIEVAL_HOOK_LIMIT`
- `PLANNING_RETRIEVAL_CHARACTER_LIMIT`
- `PLANNING_RETRIEVAL_FACTION_LIMIT`
- `PLANNING_RETRIEVAL_ITEM_LIMIT`
- `PLANNING_RETRIEVAL_RELATION_LIMIT`
- `PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT`
- `PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT`

此外，关键词长度和数量限制也已配置化：

- `PLANNING_KEYWORD_MAX_LENGTH`
- `PLANNING_INTENT_KEYWORD_LIMIT`
- `PLANNING_INTENT_MUST_INCLUDE_LIMIT`
- `PLANNING_INTENT_MUST_AVOID_LIMIT`

## 12. 一句话结论

如果只用一句话描述当前机制，可以写成：

`plan` 使用“关键词匹配驱动的优先度打分召回”，`draft` 不重新召回，而是直接继承 `plan` 固化下来的召回结果。
