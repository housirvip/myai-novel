# 长篇检索方案下的人物拆分设计（v1）

## 目标

这份文档专门回答一个问题：

> 在长篇小说检索架构里，人物应该如何拆分，才能同时兼顾连续性、召回率、可解释性和 prompt 预算？

这里的人物拆分，不是写作意义上的“人物小传”，而是 **面向检索与连续性管理的数据拆分**。

目标是把一个人物从“整条角色记录”拆成多个可独立索引、独立召回、独立预算分配的单元。

---

## 为什么必须拆人物

在中短篇里，一个人物一条摘要还勉强够用；但在百万字长篇里，这种做法会很快失效。

### 原因

1. 一个人物的信息会跨越几百上千章持续变化。
2. 某一章真正需要的，往往不是这个人物的“完整档案”，而是：
   - 当前在哪
   - 当前和谁是什么关系
   - 当前目标是什么
   - 最近发生了什么状态变化
   - 哪些承诺 / 秘密 / 伏笔还没回收
3. 如果把这些内容都揉成一条 summary：
   - embedding 粒度太粗
   - 召回噪声高
   - prompt 容易浪费预算
   - 很难解释“为什么召回了这个人物”

所以，人物必须拆。

---

## 拆分总原则

人物拆分遵循四个原则：

1. **状态优先**  
   先拆连续性最容易写错的部分。

2. **时间敏感优先**  
   能变化的信息单独拆，不能变化的信息不要混在一起。

3. **召回可解释**  
   每个拆分块都应该能回答“为什么它会被召回”。

4. **预算可裁剪**  
   被召回后，能按优先级决定“是否进入 prompt”。

---

## 人物信息的五层结构

建议把人物拆成五层：

1. **身份层（Identity）**
2. **稳定设定层（Stable Profile）**
3. **当前状态层（Current State）**
4. **关系与互动层（Relations & Social State）**
5. **事件与连续性层（Events & Continuity）**

这五层不是全都一样重要。

对 `plan` 检索来说，优先级通常应为：

1. 当前状态层
2. 关系与互动层
3. 事件与连续性层
4. 稳定设定层
5. 身份层

---

## 第一层：身份层（Identity）

### 用途

用于唯一识别人物，不负责承载长文本背景。

### 建议字段

- `character_id`
- `book_id`
- `name`
- `alias_list`
- `gender`
- `age_band`
- `species_or_race`
- `pov_priority`
- `is_major_character`
- `debut_chapter_no`
- `status`（alive / dead / missing / unknown）

### 特点

1. 基本稳定
2. 适合 exact match / alias recall
3. 不应该占太多 prompt 空间

### 索引建议

- `character:{id}:identity`

---

## 第二层：稳定设定层（Stable Profile）

### 用途

承载人物长期不易改变的设定。

### 建议字段

- `origin_background`
- `core_personality`
- `temperament`
- `combat_style` / `ability_style`
- `beliefs`
- `taboos`
- `default_value_order`
- `speech_style`
- `public_impression`
- `hidden_trait_seed`

### 这一层解决什么问题

1. 人物写崩
2. 说话方式漂移
3. 决策逻辑突然变形

### 不要混入这一层的内容

- 当前所在地
- 当前目标
- 最近关系变化
- 本章临时状态

### 索引建议

- `character:{id}:profile`
- 若文本过长，可细拆：
  - `character:{id}:profile:personality`
  - `character:{id}:profile:beliefs`
  - `character:{id}:profile:voice`

---

## 第三层：当前状态层（Current State）

### 用途

这是人物拆分里最重要的一层。它负责回答“这个人现在是什么状态”。

### 建议字段

- `current_location`
- `current_faction_affiliation`
- `current_public_identity`
- `current_hidden_identity`
- `current_goal`
- `current_pressure`
- `current_resource_state`
- `current_injury_or_condition`
- `current_emotional_state`
- `current_visibility_level`
- `current_constraint`
- `last_confirmed_chapter_no`

### 这一层最适合做细粒度 chunk

建议至少拆成下面这些 retrieval 单元：

1. `character:{id}:state:location`
2. `character:{id}:state:goal`
3. `character:{id}:state:identity`
4. `character:{id}:state:constraint`
5. `character:{id}:state:condition`
6. `character:{id}:state:emotion`

### 原因

这些字段变化频繁，而且最容易造成连续性错误。

---

## 第四层：关系与互动层（Relations & Social State）

### 用途

承载人物与其他人 / 势力 / 组织的关系状态。

### 为什么不能只靠 relation 表

因为 relation 表适合表达“关系存在”，但对写作来说，很多时候还需要人物视角下的关系状态、信任梯度、未说出口的张力。

### 建议拆法

#### A. 结构化关系记录

每一条关系应至少包括：

- `source_character_id`
- `target_entity_type`
- `target_entity_id`
- `relation_type`
- `status`
- `intensity`
- `trust_level`
- `dependency_level`
- `conflict_level`
- `exposure_level`
- `last_changed_chapter_no`

#### B. 人物侧关系状态块

除了 relation 表本身，还建议为人物生成关系侧 chunk：

- `character:{id}:relation:{target}:summary`
- `character:{id}:relation:{target}:tension`
- `character:{id}:relation:{target}:promise`
- `character:{id}:relation:{target}:hidden_truth`

### 这一层适合召回什么

1. “这两个人现在关系到哪一步了？”
2. “这章要不要继续敌对 / 暧昧 / 防备 / 利用？”
3. “哪些承诺还没兑现？”

---

## 第五层：事件与连续性层（Events & Continuity）

### 用途

这一层负责承接“人物经历过什么，以及这些经历还在影响什么”。

### 建议拆成三类

#### A. 人物事件参与记录

- `event_id`
- `chapter_no`
- `role_in_event`（initiator / victim / witness / ally / observer）
- `event_summary`
- `outcome`
- `impact_on_character`

索引建议：

- `character:{id}:event:{event_id}:summary`
- `character:{id}:event:{event_id}:impact`

#### B. 连续性事实

这是人物拆分里最关键的结构。

每条 fact 建议包括：

- `fact_id`
- `character_id`
- `fact_type`
- `fact_text`
- `source_chapter_no`
- `effective_from_chapter_no`
- `effective_to_chapter_no`（可为空）
- `importance`
- `risk_level`
- `is_blocking`
- `supersedes_fact_id`（可为空）

人物相关的 `fact_type` 推荐包括：

- `location_state`
- `identity_state`
- `goal_state`
- `injury_state`
- `resource_state`
- `knowledge_state`
- `secret_state`
- `promise_state`
- `relationship_state`
- `rule_constraint`

#### C. 未回收链路

用于回答“这个人物身上还有什么没收”。

建议字段：

- `hook_id`
- `character_id`
- `hook_role`
- `setup_summary`
- `expected_payoff`
- `urgency`
- `target_window`
- `last_touched_chapter_no`

---

## 推荐的人物 chunk 清单

如果以一个核心角色为例，建议至少生成这些 chunk：

### 基础 chunk

1. `character:{id}:identity`
2. `character:{id}:profile`
3. `character:{id}:state:location`
4. `character:{id}:state:goal`
5. `character:{id}:state:identity`
6. `character:{id}:state:constraint`
7. `character:{id}:state:condition`

### 关系 chunk

8. `character:{id}:relation:{target}:summary`
9. `character:{id}:relation:{target}:tension`
10. `character:{id}:relation:{target}:promise`

### 连续性 chunk

11. `character:{id}:fact:{fact_id}`
12. `character:{id}:event:{event_id}:impact`
13. `character:{id}:hook:{hook_id}`

对主要角色，这个数量是合理的；对边缘角色，则应降级生成，避免索引爆炸。

---

## 人物分级策略

不是所有人物都值得同样精细地拆。

### A 级：主角 / 核心主配角

建议：全拆。

包括：

- identity
- profile
- state 全部子块
- 主要关系块
- 事件 impact 块
- continuity fact 块
- unresolved hook 块

### B 级：重要配角

建议：中等拆分。

包括：

- identity
- profile
- location / goal / identity state
- 关键关系块
- 关键 fact 块

### C 级：功能型角色

建议：轻拆分。

包括：

- identity
- 简化 profile
- 单条当前状态

### D 级：一次性角色

建议：不做长期语义索引，或者只保留事件参与记录。

---

## 人物拆分后的检索优先级

在 `plan` 阶段，人物相关内容建议按下面顺序参与召回和装配：

1. blocking facts
2. current state
3. critical relations
4. unresolved hooks
5. recent event impacts
6. stable profile
7. identity

这意味着：

- “林夜现在在外门，且不能公开黑铁令来源” 这种信息，优先级远高于“林夜出身寒门、性格冷静”。

---

## 人物事实的生命周期

人物拆分后，最容易出问题的是旧事实与新事实冲突，所以必须定义生命周期。

### 建议规则

1. 稳定设定层：默认长期有效。
2. 当前状态层：新事实会覆盖旧事实。
3. 关系状态层：允许演化，不直接覆盖全部历史。
4. 事件影响层：保留历史，但要标记当前是否仍有效。
5. hook 层：未回收前持续有效，回收后归档。

### 最关键的一点

要能回答：

> 现在对这个人物“仍然有效”的事实是什么？

否则长篇里会出现“旧信息堆着不死，新信息又压不住”的问题。

---

## 推荐的人物 schema 草案

下面是一个面向检索的人物事实结构草案：

```ts
interface CharacterRetrievalFact {
  factId: string;
  bookId: number;
  characterId: number;
  factType:
    | "location_state"
    | "identity_state"
    | "goal_state"
    | "injury_state"
    | "resource_state"
    | "knowledge_state"
    | "secret_state"
    | "promise_state"
    | "relationship_state"
    | "rule_constraint";
  factText: string;
  sourceChapterNo: number;
  effectiveFromChapterNo: number;
  effectiveToChapterNo?: number | null;
  importance: number;
  riskLevel: number;
  isBlocking: boolean;
  relatedEntityIds?: Array<{
    entityType: "character" | "faction" | "item" | "hook" | "world_setting";
    entityId: number;
  }>;
  supersedesFactId?: string | null;
}
```

---

## 一个实际人物的拆分示例

以“林夜”为例。

### 不推荐的旧写法

```text
林夜，男，寒门出身，性格冷静谨慎，目前在青岳宗外门，目标是调查黑铁令，与顾沉舟互相试探，近期受宗门制度约束，不可公开令牌来源。
```

这段虽然人能看懂，但对检索不友好。

### 推荐的拆法

#### identity

```text
character:1:identity
姓名：林夜
别名：无
身份标签：主角 / 外门弟子
首次登场：第1章
```

#### profile

```text
character:1:profile
出身：寒门
性格：冷静、谨慎、隐忍
价值排序：生存 > 调查真相 > 暴露身份
说话风格：克制、少言
```

#### current state - location

```text
character:1:state:location
当前地点：青岳宗外门
最后确认章节：第128章
```

#### current state - goal

```text
character:1:state:goal
当前目标：调查黑铁令来源与宗门旧案关联
最后确认章节：第128章
```

#### current state - constraint

```text
character:1:state:constraint
当前限制：不可公开黑铁令真实来源；不得触犯宗门登记规则
风险级别：高
```

#### relation

```text
character:1:relation:2:tension
目标对象：顾沉舟
关系状态：互相试探
信任度：低
冲突度：中
最后变化章节：第126章
```

#### fact

```text
character:1:fact:f_9001
类型：identity_state
事实：林夜当前公开身份仍为青岳宗外门弟子
来源章节：第120章
是否阻断：true
```

#### hook

```text
character:1:hook:h_302
伏笔：黑铁令与宗门旧案
人物角色：持有者 / 主线调查者
预期回收：中期
```

---

## 与 prompt 装配的接口建议

人物拆分的最终目的，不是让数据库更复杂，而是让 prompt 更稳定。

所以建议在装配时，把人物相关内容映射成下面几类：

1. **人物硬约束**
   - 当前身份
   - 当前地点
   - 当前归属
   - 不可违背的限制

2. **人物连续性提醒**
   - 当前目标
   - 当前关系张力
   - 当前情绪 / 伤势 / 资源状态

3. **人物补充背景**
   - 稳定性格
   - 出身背景
   - 长期价值观

也就是说，人物拆分不应该原样塞进 prompt，而应该在检索后继续按角色分层消费。

---

## 推荐实施顺序

如果要把“人物拆分”落进项目，我建议顺序如下：

1. 先定义 `character fact types`
2. 再定义 `character state chunk` 结构
3. 再补 `relation-side character chunks`
4. 然后做 backfill / refresh pipeline
5. 再把人物层接进 retrieval pipeline
6. 最后才改 prompt assembly

原因很简单：

先把人物拆细，再讨论怎么召回、怎么组装，成本最低。

---

## 最终结论

对百万字长篇来说，人物不能再被当成“一条角色简介”。

人物必须至少被拆成：

1. 身份
2. 稳定设定
3. 当前状态
4. 关系状态
5. 连续性事实 / 事件影响 / 未回收链路

其中最关键的不是 profile，而是：

- 当前状态
- 关系张力
- 连续性事实

如果这三类拆不出来，长篇检索即使加再多 top-K，也很难稳定。
