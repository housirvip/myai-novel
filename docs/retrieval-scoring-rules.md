# 召回与打分规则说明

## 目录

- [1. 总结](#1-总结)
- [2. 相关代码位置](#2-相关代码位置)
- [3. Plan 阶段如何召回](#3-plan-阶段如何召回)
- [4. Draft 阶段是否重新召回](#4-draft-阶段是否重新召回)
- [5. 通用打分规则](#5-通用打分规则)
- [6. Reason 字段说明](#6-reason-字段说明)
- [7. 打分对照表](#7-打分对照表)
- [8. 各类实体的召回与打分规则](#8-各类实体的召回与打分规则)
- [9. 示例](#9-示例)
- [10. 风险提醒不是打分召回](#10-风险提醒不是打分召回)
- [11. 端到端 CLI 示例](#11-端到端-cli-示例)
- [12. 环境变量配置项](#12-环境变量配置项)
- [13. Prompt 拼接示例](#13-prompt-拼接示例)
- [14. 阶段关系小结](#14-阶段关系小结)
- [15. 一句话结论](#15-一句话结论)
- [相关阅读](#相关阅读)

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

## 11. 端到端 CLI 示例

下面用一个完整示例说明，从用户执行 `plan` 命令开始，到关键词提取、召回、再到最终 prompt 组装，大致会发生什么。

### 11.1 用户输入

假设用户执行：

```bash
myai-novel plan \
  --book 1 \
  --chapter 8 \
  --provider openai \
  --authorIntent "让林夜借黑铁令进入内门试炼，同时让顾沉舟察觉异常，并推进宗门旧案钩子。" \
  --characterIds 12,18 \
  --factionIds 7 \
  --itemIds 3 \
  --hookIds 5
```

这里的含义是：

- 目标是第 `8` 章
- 作者意图由用户直接提供
- 手工指定了强相关人物、势力、物品、钩子

因为已经传入了 `--authorIntent`，所以这次不会再调用“作者意图生成”那一步。

### 11.2 关键词提取结果示例

系统会先对作者意图执行关键词提取。

示例返回可能是：

```json
{
  "intentSummary": "林夜借助黑铁令进入内门试炼，并让顾沉舟开始察觉宗门旧案异常。",
  "keywords": ["林夜", "黑铁令", "内门", "试炼", "顾沉舟", "旧案"],
  "mustInclude": ["顾沉舟察觉异常", "宗门旧案推进"],
  "mustAvoid": ["直接揭晓旧案真相", "让主角无代价通关"]
}
```

当前真正参与召回的是：

- `keywords`
- 手工指定 ID

其中：

- `mustInclude`
- `mustAvoid`

目前还没有直接参与召回打分。

### 11.3 数据库里可能存在的候选数据

假设数据库中存在以下实体：

人物：

- `character:12` 林夜
- `character:18` 顾沉舟
- `character:23` 周执事

势力：

- `faction:7` 青岳宗
- `faction:9` 内门执事堂

物品：

- `item:3` 黑铁令

钩子：

- `hook:5` 黑铁令与宗门旧案
- `hook:8` 顾沉舟身份疑点

关系：

- `relation:11` 林夜 -> 青岳宗，`relation_type=member`
- `relation:17` 顾沉舟 -> 青岳宗，`relation_type=observer`

世界设定：

- `world:4` 内门试炼规则
- `world:6` 宗门等级制度

### 11.4 召回命中示例

#### 人物

`character:12` 林夜：

- 手工指定 ID：`+100`
- 命中关键词 `林夜`：`+25`
- 命中关键词 `黑铁令`：如果 `append_notes` 或 `goal` 中有相关描述，再 `+25`

可能总分：

- `125` 或 `150`

`character:18` 顾沉舟：

- 手工指定 ID：`+100`
- 命中关键词 `顾沉舟`：`+25`
- 命中关键词 `旧案`：如果背景或附加信息中有相关描述，再 `+25`

可能总分：

- `125` 或 `150`

`character:23` 周执事`：

- 没有手工指定
- 如果 `append_notes` 中提到“内门试炼”或“黑铁令”，则按命中关键词累计 `+25`

可能总分：

- `25` 或 `50`

#### 势力

`faction:7` 青岳宗：

- 手工指定 ID：`+100`
- 命中 `旧案` / `内门` / `试炼`：视字段情况每项 `+25`

可能总分：

- `125` 到 `175`

`faction:9` 内门执事堂：

- 未手工指定
- 如果 `name` 或 `description` 命中 `内门`、`试炼`，则每项 `+25`

可能总分：

- `25` 或 `50`

#### 物品

`item:3` 黑铁令：

- 手工指定 ID：`+100`
- 命中关键词 `黑铁令`：`+25`
- 若描述中含 `旧案`，再 `+25`

可能总分：

- `125` 或 `150`

#### 钩子

`hook:5` 黑铁令与宗门旧案：

- 手工指定 ID：`+100`
- 命中 `黑铁令`：`+25`
- 命中 `旧案`：`+25`
- 如果 `target_chapter_no = 8`：`+40`

可能总分：

- `190`

`hook:8` 顾沉舟身份疑点：

- 未手工指定
- 命中 `顾沉舟`：`+25`
- 若本章接近目标章节，再得到邻近加权

可能总分：

- `25`、`50` 或更高

#### 关系

`relation:11` 林夜 -> 青岳宗：

- 未手工指定关系 ID
- 因为它连接到了手工指定人物 `12` 或手工指定势力 `7`：`+35`
- 命中 `林夜`：`+25`
- 命中 `青岳宗` 或 `内门`：再 `+25`

可能总分：

- `60` 到 `85`

`relation:17` 顾沉舟 -> 青岳宗：

- 连接到了手工指定人物 `18`：`+35`
- 命中 `顾沉舟`：`+25`

可能总分：

- `60`

#### 世界设定

`world:4` 内门试炼规则：

- 未手工指定
- 命中 `内门`：`+25`
- 命中 `试炼`：`+25`

可能总分：

- `50`

`world:6` 宗门等级制度：

- 未手工指定
- 如果正文或附加说明中命中 `青岳宗`、`内门` 等，可能得到 `25` 或 `50`

### 11.5 最终召回结果示例

系统会对每一类实体单独排序、截断。

最后 `retrievedContext` 里可能出现：

- 人物：林夜、顾沉舟、周执事
- 势力：青岳宗、内门执事堂
- 物品：黑铁令
- 钩子：黑铁令与宗门旧案、顾沉舟身份疑点
- 关系：林夜 -> 青岳宗、顾沉舟 -> 青岳宗
- 世界设定：内门试炼规则、宗门等级制度
- 大纲：当前卷对应大纲
- 最近章节：第 5-7 章摘要
- 风险提醒：承接前文状态、避免遗漏旧案钩子、不要违反试炼规则

### 11.6 最终进入 Prompt 的内容关系

`plan` 阶段真正送给模型的核心输入可以概括为：

1. 章节信息
2. 作者意图
3. `retrievedContext` JSON
4. 输出要求

示意如下：

```text
章节信息：
书名：青岳入门录
章节号：第 8 章

作者意图：
让林夜借黑铁令进入内门试炼，同时让顾沉舟察觉异常，并推进宗门旧案钩子。

召回上下文（必须严格参考）：
{
  "book": { ... },
  "outlines": [ ... ],
  "recentChapters": [ ... ],
  "characters": [
    {
      "id": 12,
      "name": "林夜",
      "reason": "manual_id+keyword_hit",
      "score": 150,
      "content": "name=林夜\nabilities=...\nappend_notes=..."
    }
  ],
  "hooks": [
    {
      "id": 5,
      "title": "黑铁令与宗门旧案",
      "reason": "manual_id+keyword_hit+chapter_proximity",
      "score": 190,
      "content": "title=...\nstatus=open\n..."
    }
  ]
}

输出要求：
请输出章节规划...
```

### 11.7 retrievedContext JSON 示例

下面给一个更接近当前代码实际结构的 `retrievedContext` 示例。

```json
{
  "book": {
    "id": 1,
    "title": "青岳入门录",
    "summary": "寒门少年林夜因一枚黑铁令卷入宗门暗流。",
    "targetChapterCount": 300,
    "currentChapterCount": 7
  },
  "outlines": [
    {
      "id": 3,
      "title": "内门试炼开启",
      "reason": "outline_hit",
      "content": "title=内门试炼开启\nstory_core=林夜借黑铁令进入内门试炼\nmain_plot=推进宗门旧案支线\nsub_plot=顾沉舟开始关注林夜\nforeshadowing=黑铁令来历异常\nexpected_payoff=旧案调查线正式展开"
    }
  ],
  "recentChapters": [
    {
      "id": 5,
      "chapterNo": 7,
      "title": "山门夜讯",
      "summary": "林夜确认黑铁令会引发宗门高层异常反应，并决定继续隐藏来历。",
      "status": "approved"
    },
    {
      "id": 4,
      "chapterNo": 6,
      "title": "执事失语",
      "summary": "顾沉舟第一次注意到黑铁令，并怀疑林夜身份并不普通。",
      "status": "approved"
    }
  ],
  "hooks": [
    {
      "id": 5,
      "title": "黑铁令与宗门旧案",
      "reason": "manual_id+keyword_hit+chapter_proximity",
      "content": "title=黑铁令与宗门旧案\nhook_type=mystery\nstatus=open\nsource_chapter_no=2\ntarget_chapter_no=8\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\nappend_notes=[Chapter 7] 顾沉舟开始怀疑黑铁令与旧案有关",
      "score": 190
    },
    {
      "id": 8,
      "title": "顾沉舟身份疑点",
      "reason": "keyword_hit",
      "content": "title=顾沉舟身份疑点\nhook_type=suspense\nstatus=progressing\nsource_chapter_no=6\ndescription=顾沉舟似乎知道部分宗门旧案内幕。\nappend_notes=[Chapter 7] 顾沉舟对林夜的关注明显提高",
      "score": 50
    }
  ],
  "characters": [
    {
      "id": 12,
      "name": "林夜",
      "reason": "manual_id+keyword_hit",
      "content": "name=林夜\npersonality=冷静谨慎\nbackground=寒门出身，因黑铁令进入青岳宗视线\ncurrent_location=青岳宗外门\nprofessions=外门弟子\nlevels=炼体三重\ncurrencies={\"宗门贡献\":12,\"银两\":38}\nabilities=感知增强,危机预判\nstatus=alive\ngoal=查清黑铁令来历\nappend_notes=[Chapter 7] 决定借试炼机会接近内门",
      "score": 150
    },
    {
      "id": 18,
      "name": "顾沉舟",
      "reason": "manual_id+keyword_hit",
      "content": "name=顾沉舟\npersonality=克制敏锐\nbackground=内门执事弟子，对宗门旧案有所耳闻\ncurrent_location=青岳宗内门\nprofessions=内门执事\nlevels=聚气境\nabilities=观察入微\nstatus=alive\ngoal=确认林夜与黑铁令的关系\nappend_notes=[Chapter 7] 对林夜保持暗中观察",
      "score": 125
    }
  ],
  "factions": [
    {
      "id": 7,
      "name": "青岳宗",
      "reason": "manual_id+keyword_hit",
      "content": "name=青岳宗\ncategory=宗门\ncore_goal=维持宗门秩序并压制旧案余波\ndescription=东境大宗门，内部派系复杂\nheadquarter=青岳山\nstatus=active\nappend_notes=[Chapter 6] 内门对黑铁令出现异常关注",
      "score": 150
    }
  ],
  "items": [
    {
      "id": 3,
      "name": "黑铁令",
      "reason": "manual_id+keyword_hit",
      "content": "name=黑铁令\ncategory=身份凭证\ndescription=可用于特殊身份核验，疑似与旧案有关\nowner_type=character\nowner_id=12\nrarity=rare\nstatus=active\nappend_notes=[Chapter 7] 进入内门试炼可能需要再次出示",
      "score": 150
    }
  ],
  "relations": [
    {
      "id": 11,
      "reason": "manual_entity_link+keyword_hit",
      "content": "source=林夜 (character:12)\ntarget=青岳宗 (faction:7)\nrelation_type=member\nstatus=active\ndescription=林夜正式以外门弟子身份进入青岳宗。\nappend_notes=[Chapter 2] 林夜完成入宗登记",
      "score": 85
    },
    {
      "id": 17,
      "reason": "manual_entity_link+keyword_hit",
      "content": "source=顾沉舟 (character:18)\ntarget=青岳宗 (faction:7)\nrelation_type=observer\nstatus=active\ndescription=顾沉舟以内门执事身份关注林夜动向。\nappend_notes=[Chapter 7] 关注强度上升",
      "score": 60
    }
  ],
  "worldSettings": [
    {
      "id": 4,
      "title": "内门试炼规则",
      "reason": "keyword_hit",
      "content": "title=内门试炼规则\ncategory=宗门规则\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\nappend_notes=[Chapter 5] 黑铁令可能触发破格资格",
      "score": 50
    },
    {
      "id": 6,
      "title": "宗门等级制度",
      "reason": "keyword_hit",
      "content": "title=宗门等级制度\ncategory=职业体系\ncontent=青岳宗分外门、内门、真传三级，跨级接触需有明确理由。\nappend_notes=[Chapter 3] 越级接触通常会引发审查",
      "score": 25
    }
  ],
  "riskReminders": [
    "存在接近回收章节的故事钩子，避免遗漏推进。",
    "注意承接最近 2 章的状态延续和人物位置变化。",
    "注意不要违反已激活的世界规则、职业体系或货币体系。"
  ]
}
```

这个结构和当前代码中的 `PlanRetrievedContext` 一致，主要特点是：

- 每类实体都带 `reason`
- 每类实体都带 `score`
- 真实喂给模型的关键信息在 `content`
- `content` 不是原始 JSON 行，而是压缩后的多行文本

### 11.7 Draft 为什么不重新召回

继续以上例子。

假设第 8 章 `plan` 已经完成，并把上面的 `retrievedContext` 存入：

- `chapter_plans.retrieved_context`

然后用户第二天新增了一个人物：

- `character:31` 韩牧，且关键词也命中“内门”

如果此时直接执行第 8 章 `draft`：

- 系统不会重新把 `character:31` 拉进来
- 因为 `draft` 只会读取上一次 `plan` 保存的 `retrievedContext`

想让这个新人物也进入本章写作上下文，必须：

- 重新执行一次第 8 章 `plan`

这样做的原因是：

- 保持 `plan`、`draft`、`review`、`repair`、`approve` 在同一章里共享同一版事实边界
- 防止一个章节在不同阶段使用不同召回结果，导致内容不稳定

## 12. 环境变量配置项

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

## 13. Prompt 拼接示例

下面给出两组更贴近实际代码的 prompt 示例，分别对应：

- `plan` 阶段的章节规划请求
- `draft` 阶段的正文生成请求

注意：

- 这里展示的是业务层传给 LLM 的 `messages`
- 如果请求的是 JSON 输出，provider 层还会额外追加一条“只返回合法 JSON”的约束
- 文中内容做了适度缩写，但结构与当前代码一致

### 13.1 Plan Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildPlanPrompt()`

最终传给 LLM 的 `messages` 结构大致如下：

```json
[
  {
    "role": "system",
    "content": "你是一名长篇网文策划助手。请基于作者意图、召回上下文和最近章节状态，输出可直接用于写作的章节规划。召回上下文中的人物、势力、关系、物品、钩子、世界规则默认都应视为有效约束。规划必须优先保证连续性、设定一致性、人物动机成立和钩子推进清晰。"
  },
  {
    "role": "user",
    "content": "章节信息：\n书名：青岳入门录\n章节号：第 8 章\n\n作者意图：\n让林夜借黑铁令进入内门试炼，同时让顾沉舟察觉异常，并推进宗门旧案钩子。\n\n召回上下文（必须严格参考）：\n{\n  \"book\": {\n    \"id\": 1,\n    \"title\": \"青岳入门录\",\n    \"summary\": \"寒门少年林夜因一枚黑铁令卷入宗门暗流。\",\n    \"targetChapterCount\": 300,\n    \"currentChapterCount\": 7\n  },\n  \"recentChapters\": [\n    {\n      \"id\": 5,\n      \"chapterNo\": 7,\n      \"title\": \"山门夜讯\",\n      \"summary\": \"林夜确认黑铁令会引发宗门高层异常反应，并决定继续隐藏来历。\",\n      \"status\": \"approved\"\n    }\n  ],\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"reason\": \"manual_id+keyword_hit\",\n      \"content\": \"name=林夜\\npersonality=冷静谨慎\\ncurrent_location=青岳宗外门\\nprofessions=外门弟子\\nlevels=炼体三重\\nabilities=感知增强,危机预判\\nstatus=alive\\ngoal=查清黑铁令来历\",\n      \"score\": 150\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"reason\": \"manual_id+keyword_hit\",\n      \"content\": \"name=顾沉舟\\npersonality=克制敏锐\\ncurrent_location=青岳宗内门\\nprofessions=内门执事\\nstatus=alive\\ngoal=确认林夜与黑铁令的关系\",\n      \"score\": 125\n    }\n  ],\n  \"hooks\": [\n    {\n      \"id\": 5,\n      \"title\": \"黑铁令与宗门旧案\",\n      \"reason\": \"manual_id+keyword_hit+chapter_proximity\",\n      \"content\": \"title=黑铁令与宗门旧案\\nhook_type=mystery\\nstatus=open\\ntarget_chapter_no=8\\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\",\n      \"score\": 190\n    }\n  ],\n  \"worldSettings\": [\n    {\n      \"id\": 4,\n      \"title\": \"内门试炼规则\",\n      \"reason\": \"keyword_hit\",\n      \"content\": \"title=内门试炼规则\\ncategory=宗门规则\\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\",\n      \"score\": 50\n    }\n  ],\n  \"riskReminders\": [\n    \"存在接近回收章节的故事钩子，避免遗漏推进。\",\n    \"注意承接最近 2 章的状态延续和人物位置变化。\",\n    \"注意不要违反已激活的世界规则、职业体系或货币体系。\"\n  ]\n}\n\n输出要求：\n请输出章节规划。\n至少包含：本章目标、主线、支线、出场角色、出场势力、关键道具、钩子推进、节奏分段、风险提醒。\n如果召回上下文里存在风险提醒、未回收钩子、关键关系或世界规则，规划中必须显式承接。"
  }
]
```

这个 prompt 的要点是：

- `system` 负责定义“这是规划任务”以及“召回内容是约束”
- `user` 负责把章节信息、作者意图和完整 `retrievedContext` 全部塞进去
- 最后再显式给出输出格式要求

### 13.2 Draft Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildDraftPrompt()`

`draft` 阶段不会重新召回，而是直接复用 `plan` 保存下来的 `retrievedContext`。  
因此它发给 LLM 的 `messages` 通常长这样：

```json
[
  {
    "role": "system",
    "content": "你是一名长篇网络小说写作助手。请根据章节规划创作完整、自然、连贯的章节草稿。召回上下文中的人物状态、关系、势力信息、物品归属、钩子状态、世界规则，默认都应视为硬约束。如果章节规划与召回上下文有细微冲突，优先保证设定一致和前后连续，再在正文里自然化处理。不要为了推进剧情而随意改写人物性格、能力边界、世界规则、货币体系、战力体系。若必须引入新信息，请保持克制，并避免与已召回设定直接冲突。输出时只给正文，不要附解释、标题清单或额外说明。"
  },
  {
    "role": "user",
    "content": "章节规划：\n本章目标：让林夜借黑铁令进入内门试炼，并让顾沉舟确认其异常价值。\n主线：林夜在进入试炼前遭遇审查，通过黑铁令获得破格资格。\n支线：顾沉舟对林夜的关注升级，并开始主动试探。\n出场角色：林夜、顾沉舟、周执事。\n出场势力：青岳宗、内门执事堂。\n关键道具：黑铁令。\n钩子推进：明确黑铁令与宗门旧案关联更深，但暂不揭晓真相。\n节奏分段：入场审查、资格争议、顾沉舟试探、试炼开启前悬念收束。\n风险提醒：避免让主角无代价通关；保持宗门等级规则成立。\n\n召回上下文（必须严格参考）：\n{\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"reason\": \"manual_id+keyword_hit\",\n      \"content\": \"name=林夜\\npersonality=冷静谨慎\\ncurrent_location=青岳宗外门\\nprofessions=外门弟子\\nlevels=炼体三重\\nabilities=感知增强,危机预判\\nstatus=alive\\ngoal=查清黑铁令来历\",\n      \"score\": 150\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"reason\": \"manual_id+keyword_hit\",\n      \"content\": \"name=顾沉舟\\npersonality=克制敏锐\\ncurrent_location=青岳宗内门\\nprofessions=内门执事\\nstatus=alive\\ngoal=确认林夜与黑铁令的关系\",\n      \"score\": 125\n    }\n  ],\n  \"items\": [\n    {\n      \"id\": 3,\n      \"name\": \"黑铁令\",\n      \"reason\": \"manual_id+keyword_hit\",\n      \"content\": \"name=黑铁令\\ndescription=可用于特殊身份核验，疑似与旧案有关\\nowner_type=character\\nowner_id=12\\nstatus=active\",\n      \"score\": 150\n    }\n  ],\n  \"hooks\": [\n    {\n      \"id\": 5,\n      \"title\": \"黑铁令与宗门旧案\",\n      \"reason\": \"manual_id+keyword_hit+chapter_proximity\",\n      \"content\": \"title=黑铁令与宗门旧案\\nstatus=open\\ntarget_chapter_no=8\\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\",\n      \"score\": 190\n    }\n  ],\n  \"worldSettings\": [\n    {\n      \"id\": 4,\n      \"title\": \"内门试炼规则\",\n      \"reason\": \"keyword_hit\",\n      \"content\": \"title=内门试炼规则\\ncategory=宗门规则\\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\",\n      \"score\": 50\n    }\n  ],\n  \"riskReminders\": [\n    \"存在接近回收章节的故事钩子，避免遗漏推进。\",\n    \"注意不要违反已激活的世界规则、职业体系或货币体系。\"\n  ]\n}\n\n目标字数：\n3500\n\n写作要求：\n1. 必须覆盖章节规划中的主线推进、支线推进和钩子推进。\n2. 人物行为要符合已召回的人设、目标、位置、能力和关系。\n3. 世界设定、势力状态、物品状态、关系状态不能自相矛盾。\n4. 节奏上要像小说正文，不要写成大纲复述。\n5. 如果上下文里有风险提醒，正文中要主动规避对应问题。\n6. 只输出完整章节草稿正文。"
  }
]
```

这个 prompt 的要点是：

- `planContent` 决定本章怎么写
- `retrievedContext` 决定本章不能写错什么
- `riskReminders` 相当于额外的高层约束

### 13.3 JSON 类请求的额外补充

如果是 `review`、`approve diff`、`关键词提取` 这类要求 JSON 输出的请求，provider 层还会自动补一句类似：

```text
Return valid JSON only. Do not include markdown fences or extra explanation.
```

补充位置：

- OpenAI / Custom：追加为一条 `system`
- Anthropic：追加为一条 `user`

所以在排查“为什么模型返回了不规范 JSON”时，要同时看：

- 业务层 prompt 模板
- provider 层是否成功追加了 JSON 限制语句

### 13.4 Review Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildReviewPrompt()`

`review` 阶段的职责不是继续创作，而是用同一套规划和召回事实去反向检查草稿是否出错。  
它发给 LLM 的 `messages` 大致如下：

```json
[
  {
    "role": "system",
    "content": "你是一名长篇小说审校助手。请检查草稿在设定一致性、人物行为、节奏、逻辑链路、关系演变和钩子推进上的问题。召回上下文中的事实默认都应视为核对基准。输出应聚焦真正影响正文质量和连续性的关键问题，不要泛泛而谈。"
  },
  {
    "role": "user",
    "content": "章节规划：\n本章目标：让林夜借黑铁令进入内门试炼，并让顾沉舟确认其异常价值。\n主线：林夜在进入试炼前遭遇审查，通过黑铁令获得破格资格。\n支线：顾沉舟对林夜的关注升级，并开始主动试探。\n\n章节草稿：\n晨雾压在山门石阶上，林夜握着黑铁令走向内门执事堂......\n\n召回上下文（作为核对基准）：\n{\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"content\": \"name=林夜\\npersonality=冷静谨慎\\ncurrent_location=青岳宗外门\\nlevels=炼体三重\\nabilities=感知增强,危机预判\\nstatus=alive\"\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"content\": \"name=顾沉舟\\npersonality=克制敏锐\\ncurrent_location=青岳宗内门\\nprofessions=内门执事\\nstatus=alive\"\n    }\n  ],\n  \"hooks\": [\n    {\n      \"id\": 5,\n      \"title\": \"黑铁令与宗门旧案\",\n      \"content\": \"title=黑铁令与宗门旧案\\nstatus=open\\ntarget_chapter_no=8\\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\"\n    }\n  ],\n  \"worldSettings\": [\n    {\n      \"id\": 4,\n      \"title\": \"内门试炼规则\",\n      \"content\": \"title=内门试炼规则\\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\"\n    }\n  ]\n}\n\n输出要求：\n请输出：总结、问题列表、风险列表、连续性检查、修复建议。\n优先指出会导致后续章节连锁出错的问题。\n如果没有问题，也要明确说明连续性是否稳定。"
  }
]
```

这个 prompt 的要点是：

- `planContent` 是本章应达到的目标基线
- `draftContent` 是待检查对象
- `retrievedContext` 是设定与连续性核对基准
- 输出目标是结构化审查结果，而不是文学评论

### 13.5 Repair Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildRepairPrompt()`

`repair` 阶段会同时带上：

- 原始 `plan`
- 当前 `draft`
- `review` 结果
- 原始 `retrievedContext`

示例如下：

```json
[
  {
    "role": "system",
    "content": "你是一名小说修稿助手。请根据章节规划、召回上下文和审阅意见修复章节草稿，尽量少破坏已有可用内容，并保持主线、设定和人物行为一致。"
  },
  {
    "role": "user",
    "content": "章节规划：\n本章目标：让林夜借黑铁令进入内门试炼，并让顾沉舟确认其异常价值。\n主线：林夜在进入试炼前遭遇审查，通过黑铁令获得破格资格。\n支线：顾沉舟对林夜的关注升级，并开始主动试探。\n\n当前草稿：\n晨雾压在山门石阶上，林夜握着黑铁令走向内门执事堂......\n\n审阅结果：\n{\"summary\":\"主线成立，但审查流程略显轻飘。\",\"issues\":[\"顾沉舟出场过晚，支线承接偏弱。\",\"试炼资格放行过快，削弱世界规则约束。\"],\"risks\":[\"若不强化审查阻力，主角会显得推进过顺。\"],\"continuity_checks\":[\"黑铁令仍归林夜持有。\"],\"repair_suggestions\":[\"增加执事与顾沉舟的双重确认环节。\"]}\n\n召回上下文（必须保持一致）：\n{\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"content\": \"name=林夜\\npersonality=冷静谨慎\\ncurrent_location=青岳宗外门\\nlevels=炼体三重\\nstatus=alive\"\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"content\": \"name=顾沉舟\\npersonality=克制敏锐\\ncurrent_location=青岳宗内门\\nprofessions=内门执事\\nstatus=alive\"\n    }\n  ],\n  \"items\": [\n    {\n      \"id\": 3,\n      \"name\": \"黑铁令\",\n      \"content\": \"name=黑铁令\\nowner_type=character\\nowner_id=12\\nstatus=active\"\n    }\n  ],\n  \"worldSettings\": [\n    {\n      \"id\": 4,\n      \"title\": \"内门试炼规则\",\n      \"content\": \"title=内门试炼规则\\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\"\n    }\n  ]\n}\n\n修稿要求：\n优先修复审阅问题，同时不要偏离既有规划和召回设定。\n如果草稿已有可用段落，尽量保留其节奏、气氛和信息密度。\n只输出修复后的完整草稿正文。"
  }
]
```

这个 prompt 的要点是：

- `repair` 不是重新自由创作
- `review` 只是问题清单，不能替代原始 `plan` 与事实约束
- 修稿优先级是“修问题”，但边界条件仍然是 `plan + retrievedContext`

### 13.6 Approve Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildApprovePrompt()`

`approve` 阶段会把“当前最优草稿”进一步整理成正式稿。  
它和 `repair` 很像，但目标更偏向“最终可保存版本”。

```json
[
  {
    "role": "system",
    "content": "你是一名长篇小说定稿助手。请基于章节规划、当前草稿、审阅结果和召回上下文，输出可直接作为正式稿保存的最终章节文稿。你必须修复审阅里指出的问题，同时保留章节原本应推进的主线、支线、人物关系和钩子。召回上下文中的设定与事实默认都应视为正式约束，不要为了润色而改坏连续性。输出时只给最终正文，不要附带说明、批注、总结或解释。"
  },
  {
    "role": "user",
    "content": "章节规划：\n本章目标：让林夜借黑铁令进入内门试炼，并让顾沉舟确认其异常价值。\n主线：林夜在进入试炼前遭遇审查，通过黑铁令获得破格资格。\n支线：顾沉舟对林夜的关注升级，并开始主动试探。\n\n当前草稿：\n晨雾压在山门石阶上，林夜握着黑铁令走向内门执事堂......\n\n审阅结果：\n{\"summary\":\"主线成立，但审查流程略显轻飘。\",\"issues\":[\"顾沉舟出场过晚，支线承接偏弱。\",\"试炼资格放行过快，削弱世界规则约束。\"],\"risks\":[\"若不强化审查阻力，主角会显得推进过顺。\"],\"continuity_checks\":[\"黑铁令仍归林夜持有。\"],\"repair_suggestions\":[\"增加执事与顾沉舟的双重确认环节。\"]}\n\n召回上下文（必须保持一致）：\n{\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"content\": \"name=林夜\\npersonality=冷静谨慎\\ncurrent_location=青岳宗外门\\nlevels=炼体三重\\nstatus=alive\"\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"content\": \"name=顾沉舟\\npersonality=克制敏锐\\ncurrent_location=青岳宗内门\\nprofessions=内门执事\\nstatus=alive\"\n    }\n  ],\n  \"hooks\": [\n    {\n      \"id\": 5,\n      \"title\": \"黑铁令与宗门旧案\",\n      \"content\": \"title=黑铁令与宗门旧案\\nstatus=open\\ntarget_chapter_no=8\\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\"\n    }\n  ],\n  \"worldSettings\": [\n    {\n      \"id\": 4,\n      \"title\": \"内门试炼规则\",\n      \"content\": \"title=内门试炼规则\\ncontent=外门弟子若持特殊通行凭证，可破格参与部分内门试炼，但必须接受额外审查。\"\n    }\n  ]\n}\n\n定稿要求：\n1. 修复审阅中提到的问题。\n2. 不要丢失原计划中的关键剧情推进和钩子推进。\n3. 不要违背召回出的设定、人物状态、关系和世界规则。\n4. 尽量继承当前草稿中已经写得好的段落和气氛。\n5. 只输出最终文稿正文。"
  }
]
```

这个 prompt 的要点是：

- `approve` 比 `repair` 更强调“可落库的正式稿”
- 它并不是简单把当前草稿标记为 final，而是允许模型再整理一次
- 但整理空间仍然受 `plan`、`review`、`retrievedContext` 三重约束

### 13.7 Approve Diff Prompt 示例

对应代码：

- `src/domain/planning/prompts.ts`
- `buildApproveDiffPrompt()`

这是 `approve` 阶段的第二次模型调用，用来从最终正文里抽取结构化事实变更。  
它不是写正文，而是做“事实整理”。

```json
[
  {
    "role": "system",
    "content": "你是一名小说事实整理助手。请根据最终文稿、章节规划和审阅结果，输出结构化 JSON，用于更新设定数据库。"
  },
  {
    "role": "user",
    "content": "最终文稿：\n晨雾压在山门石阶上，林夜握着黑铁令走向内门执事堂......\n\n章节规划：\n本章目标：让林夜借黑铁令进入内门试炼，并让顾沉舟确认其异常价值。\n主线：林夜在进入试炼前遭遇审查，通过黑铁令获得破格资格。\n支线：顾沉舟对林夜的关注升级，并开始主动试探。\n\n审阅结果：\n{\"summary\":\"主线成立，但审查流程略显轻飘。\",\"issues\":[\"顾沉舟出场过晚，支线承接偏弱。\"],\"risks\":[\"若不强化审查阻力，主角会显得推进过顺。\"],\"continuity_checks\":[\"黑铁令仍归林夜持有。\"],\"repair_suggestions\":[\"增加执事与顾沉舟的双重确认环节。\"]}\n\n召回上下文（用于校对事实变更）：\n{\n  \"characters\": [\n    {\n      \"id\": 12,\n      \"name\": \"林夜\",\n      \"content\": \"name=林夜\\nstatus=alive\\ngoal=查清黑铁令来历\"\n    },\n    {\n      \"id\": 18,\n      \"name\": \"顾沉舟\",\n      \"content\": \"name=顾沉舟\\nstatus=alive\\ngoal=确认林夜与黑铁令的关系\"\n    }\n  ],\n  \"items\": [\n    {\n      \"id\": 3,\n      \"name\": \"黑铁令\",\n      \"content\": \"name=黑铁令\\nowner_type=character\\nowner_id=12\\nstatus=active\"\n    }\n  ],\n  \"hooks\": [\n    {\n      \"id\": 5,\n      \"title\": \"黑铁令与宗门旧案\",\n      \"content\": \"title=黑铁令与宗门旧案\\nstatus=open\\ndescription=黑铁令可能与宗门旧案相关，后续需要追查来源。\"\n    }\n  ]\n}\n\n输出要求：\n请返回 JSON。\n字段包含：chapterSummary, actualCharacterIds, actualFactionIds, actualItemIds, actualHookIds, actualWorldSettingIds, newCharacters, newFactions, newItems, newHooks, newWorldSettings, newRelations, updates。\nnewRelations 用于新增关系，字段包含 sourceType, sourceId, targetType, targetId, relationType, intensity, status, description, keywords。\nupdates 中的 entityType 支持 character, faction, relation, item, story_hook, world_setting；action 支持 update_fields, append_notes, status_change。\nactual*Ids 应只保留本章真实出场或真实产生影响的实体。"
  }
]
```

示例输出可能长这样：

```json
{
  "chapterSummary": "林夜借黑铁令通过额外审查，进入内门试炼，顾沉舟也正式确认他与宗门旧案有关。",
  "actualCharacterIds": [12, 18],
  "actualFactionIds": [7],
  "actualItemIds": [3],
  "actualHookIds": [5],
  "actualWorldSettingIds": [4],
  "newCharacters": [],
  "newFactions": [],
  "newItems": [],
  "newHooks": [],
  "newWorldSettings": [],
  "newRelations": [],
  "updates": [
    {
      "entityType": "story_hook",
      "entityId": 5,
      "action": "append_notes",
      "payload": {
        "note": "第8章中顾沉舟已明确确认黑铁令与宗门旧案存在强关联。"
      }
    },
    {
      "entityType": "character",
      "entityId": 18,
      "action": "append_notes",
      "payload": {
        "note": "第8章起顾沉舟从被动观察转为主动试探林夜。"
      }
    }
  ]
}
```

这个 prompt 的要点是：

- 第一轮 `approve` 负责产出最终正文
- 第二轮 `approve diff` 负责把正文里的事实变化抽成结构化更新
- 它是“写作闭环”中数据库回写的关键一环

## 14. 阶段关系小结

如果把这几个 prompt 放在一起看，它们分别承担的是：

- `plan`：决定这章要怎么写
- `draft`：在规划和召回约束内写出正文
- `review`：检查正文是否违背规划与设定
- `repair`：在原规划和事实边界内修草稿
- `approve`：输出最终可保存的正文版本
- `approve diff`：把最终正文里的事实变化抽取出来，回写数据库

因此它们不是独立的 6 个请求，而是一条共享上下文的工作流链路。

## 15. 一句话结论

如果只用一句话描述当前机制，可以写成：

`plan` 使用“关键词匹配驱动的优先度打分召回”，`draft` 不重新召回，而是直接继承 `plan` 固化下来的召回结果。

## 相关阅读

- [`README.md`](../README.md)
- [`docs/cli-usage-guide.md`](./cli-usage-guide.md)
- [`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
