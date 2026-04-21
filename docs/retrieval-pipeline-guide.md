# Retrieval 全链路详解

本文专门说明 `plan` 阶段 retrieval 的完整链路，从输入、候选获取、可选 embedding 补候选、可选 rerank，到最终 `retrievedContext` 装配，全部串起来说明。

重点回答这些问题：

- `plan` 阶段到底是怎么取数的
- 为什么 retrieval 只发生在 `plan`，而不是每个阶段都重新查库
- candidate provider、reranker、context builder 各自负责什么
- `hardConstraints / softReferences / priorityContext / riskReminders / recentChanges` 是怎么来的
- persisted sidecar 是如何进入这条链路的
- embedding 实验链路是怎么接进主流程的
- retrieval observability 现在落在哪一层

如果你想看的是：

- 具体打分权重：看 `docs/retrieval-scoring-rules.md`
- prompt 如何消费上下文：看 `docs/prompt-retrieval-relationship.md`
- sidecar 与 provenance 如何接进 retrieval：看 `docs/retrieval-sidecar-provenance-guide.md`
- 章节全流水线：看 `docs/chapter-pipeline-overview.md`

## 目录

- [1. 涉及文件](#1-涉及文件)
- [2. 一句话理解](#2-一句话理解)
- [3. 总流程图](#3-总流程图)
- [4. 时序图](#4-时序图)
- [5. 链路分层图](#5-链路分层图)
- [6. 入口层：`RetrievalQueryService`](#6-入口层retrievalqueryservice)
- [7. 输入层：`RetrievePlanContextParams`](#7-输入层retrieveplancontextparams)
- [8. 候选层：`RuleBasedCandidateProvider`](#8-候选层rulebasedcandidateprovider)
- [9. 排序前候选长什么样](#9-排序前候选长什么样)
- [10. 实验补充层：`EmbeddingCandidateProvider`](#10-实验补充层embeddingcandidateprovider)
- [11. rerank 层：直通或 Heuristic](#11-rerank-层直通或-heuristic)
- [12. 装配层：`buildRetrievedContext()`](#12-装配层buildretrievedcontext)
- [13. `hardConstraints` 是怎么来的](#13-hardconstraints-是怎么来的)
- [14. `priorityContext` 是怎么来的](#14-prioritycontext-是怎么来的)
- [15. `riskReminders` 和 `recentChanges` 是怎么来的](#15-riskreminders-和-recentchanges-是怎么来的)
- [16. 工厂层：`createPlanningRetrievalService()`](#16-工厂层createplanningretrievalservice)
- [17. 为什么 retrieval 只发生在 `plan`](#17-为什么-retrieval-只发生在-plan)
- [18. 两次 retrieval 在 `plan` 里的位置](#18-两次-retrieval-在-plan-里的位置)
- [19. 一个完整例子：从 `plan` 输入到最终 Prompt](#19-一个完整例子从-plan-输入到最终-prompt)
- [20. 当前实现特征](#20-当前实现特征)
- [21. 推荐阅读顺序](#21-推荐阅读顺序)
- [相关阅读](#相关阅读)

## 1. 涉及文件

- 服务入口：`src/domain/planning/retrieval-service.ts`
- 候选/重排接口：`src/domain/planning/retrieval-pipeline.ts`
- 规则候选提供器：`src/domain/planning/retrieval-candidate-provider-rule.ts`
- reranker 选择：`src/domain/planning/retrieval-reranker-factory.ts`
- heuristic reranker：`src/domain/planning/retrieval-reranker-heuristic.ts`
- 上下文装配：`src/domain/planning/retrieval-context-builder.ts`
- hard constraints：`src/domain/planning/retrieval-hard-constraints.ts`
- priority context：`src/domain/planning/retrieval-facts.ts`
- risk reminders：`src/domain/planning/retrieval-risk-reminders.ts`
- embedding 接线：`src/domain/planning/retrieval-service-factory.ts`
- embedding 候选补充：`src/domain/planning/embedding-candidate-provider.ts`

## 2. 一句话理解

当前 retrieval 主链本质上是：

- 用规则式 provider 先拉候选
- 可选地补入 embedding 候选
- 可选地做 heuristic rerank
- 再把结果收口成一份结构化 `retrievedContext`

而这份 `retrievedContext` 不是临时召回结果，而是会被持久化到 `chapter_plans` 并被后续阶段共享的事实基线。

## 3. 总流程图

```mermaid
flowchart TD
    A1[plan 输入
bookId / chapterNo / keywords / manualRefs]

    B1[RetrievalQueryService]
    B2[RuleBasedCandidateProvider]
    B3[EmbeddingCandidateProvider
可选]
    B4[Reranker
直通或 Heuristic]

    C1[候选大纲]
    C2[最近章节摘要]
    C3[候选实体组
hooks / characters / factions / items / relations / worldSettings]

    D1[buildHardConstraints]
    D2[buildRiskReminders]
    D3[buildPriorityContext]
    D4[buildRecentChanges]
    D5[buildRetrievalObservability]

    E1[buildRetrievedContext]
    E2[PlanRetrievedContext]
    E3[chapter_plans.retrieved_context]

    A1 --> B1 --> B2 --> C1
    B2 --> C2
    B2 --> C3
    C3 --> B3
    B3 --> B4
    C1 --> B4
    C2 --> B4
    B4 --> D1
    B4 --> D2
    B4 --> D3
    B4 --> D4
    D1 --> E1
    D2 --> E1
    D3 --> E1
    D4 --> E1
    D5 --> E1
    E1 --> E2 --> E3
```

## 4. 时序图

```mermaid
sequenceDiagram
    participant Plan as PlanWorkflow
    participant Factory as retrieval-service-factory
    participant Service as RetrievalQueryService
    participant Provider as CandidateProvider
    participant Reranker as RetrievalReranker
    participant Builder as retrieval-context-builder
    participant DB as Database

    Plan->>Factory: createPlanningRetrievalService(bookId)
    alt embedding 关闭
        Factory-->>Plan: RetrievalQueryService(rule-only)
    else embedding 开启
        Factory->>DB: 加载 characters / factions / items / hooks / relations / world_settings
        Factory->>Factory: refresh embedding documents
        Factory-->>Plan: RetrievalQueryService(rule + embedding)
    end

    Plan->>Service: retrievePlanContext(bookId, chapterNo, keywords, manualRefs)
    Service->>DB: 读取 book
    Service->>Provider: loadCandidates(db, params)
    Provider->>DB: 查询 outlines / chapters / entities
    Provider-->>Service: candidate bundle
    Service->>Reranker: rerank(params, candidates)
    Reranker-->>Service: reranked bundle
    Service->>Builder: buildRetrievedContext(book, reranked)
    Builder-->>Service: PlanRetrievedContext
    Service-->>Plan: retrievedContext
```

## 5. 链路分层图

```mermaid
flowchart LR
    A[输入层
keywords / manualRefs / chapterNo]
    B[候选层
RuleBasedCandidateProvider]
    C[实验补充层
EmbeddingCandidateProvider]
    D[排序层
DirectPassThrough or HeuristicReranker]
    E[结构化装配层
Context Builder]
    F[消费层
plan -> draft/review/repair/approve]

    A --> B --> C --> D --> E --> F
```

这张图表达的是职责边界：

- 输入层决定查询信号
- 候选层决定先把哪些数据拉出来
- 实验层负责补候选，不替代主链
- 排序层决定候选顺序
- 装配层决定最终上下文结构
- 消费层只读 `retrievedContext`，不关心 retrieval 细节

## 6. 入口层：`RetrievalQueryService`

`RetrievalQueryService` 是当前 retrieval 的统一服务入口。

它当前做三件事：

- 读取 `books` 基础信息
- 调用 candidate provider 获取候选集
- 调用 reranker 排序后，再交给 context builder 装配成 `PlanRetrievedContext`
- 在返回前输出一条紧凑的 retrieval observability summary log

它本身不关心：

- 规则候选是怎么查出来的
- embedding 是怎么补进来的
- heuristic rerank 具体怎么算分

这些都交给下游组件完成。

## 7. 输入层：`RetrievePlanContextParams`

当前 retrieval 输入统一抽象成：

- `bookId`
- `chapterNo`
- `keywords`
- `manualRefs`

这四类信号的作用不同：

### 7.1 `bookId`

决定整次 retrieval 的书籍边界。

### 7.2 `chapterNo`

决定：

- 应命中的大纲范围
- 最近章节摘要窗口
- 钩子邻近性判断

### 7.3 `keywords`

决定：

- 文本命中打分
- query boost 触发
- embedding 查询文本

### 7.4 `manualRefs`

决定：

- 手工强指定实体优先级
- 关系和多实体联动场景的显式锚点

## 8. 候选层：`RuleBasedCandidateProvider`

默认候选层是：

- `RuleBasedCandidateProvider`

它当前负责拉三大类候选：

### 8.1 大纲候选

从 `outlines` 里取：

- 当前章节范围覆盖的大纲

### 8.2 最近章节候选

从 `chapters` 里取：

- 当前章节之前、状态不为 `todo` 的近期章节

并且会优先补全摘要来源：

- 先用 `chapters.summary`
- 没有则回退到当前 final / draft / plan 的摘要字段

### 8.3 实体候选

当前会拉这六组实体：

- `characters`
- `factions`
- `items`
- `hooks`
- `relations`
- `worldSettings`

每组实体都在 provider 层完成：

- 扫描表
- 基础打分
- query boost 加权
- reason 生成
- 截断 limit

## 9. 排序前候选长什么样

每个实体候选在 provider 层都会先被转成统一的 `RetrievedEntity`，关键字段包括：

- `id`
- `name/title`
- `reason`
- `content`
- `score`

这里最关键的是两个字段：

### 9.1 `reason`

它不是给机器二次算分用的主字段，而是：

- explainability 字段
- 给后续 heuristic reranker、context builder、prompt 理解“为什么命中”提供信号

### 9.2 `content`

它不是原始行对象，而是被压成了面向 retrieval 的“扁平文本块”，例如：

- `name=...`
- `current_location=...`
- `status=...`
- `append_notes=...`

这让后续层更容易：

- 做统一关键词命中
- 做 continuity 判断
- 做 prompt 展示

## 10. 实验补充层：`EmbeddingCandidateProvider`

如果开启 embedding，当前不会替换规则主链，而是：

- 先跑规则 provider
- 再用 `EmbeddingCandidateProvider` 把语义命中结果补进候选集

当前补候选逻辑的特点是：

- 对缺失候选补入 `reason=embedding_match`
- 对已命中的同 ID 候选追加 `embedding_support`
- 新补进来的候选会带 `reason=embedding_match`

这层的定位很明确：

- 实验补充层
- 不是正式默认主链的替代品

## 11. rerank 层：直通或 Heuristic

当前 reranker 通过 `createConfiguredReranker()` 选择：

- `none` -> `DirectPassThroughReranker`
- `heuristic` -> `HeuristicReranker`

### 11.1 `DirectPassThroughReranker`

作用非常简单：

- 直接透传候选顺序

### 11.2 `HeuristicReranker`

会在已有 `score` 基础上再叠加一层启发式排序信号，例如：

- `manual_id`
- `keyword_hit`
- `embedding_match`
- `embedding_support`
- 关键词命中次数
- continuity bonus
- hook 的目标章节邻近性

这层做的不是重新查库，而是：

- 在候选已经拿到之后，做更轻量的二次排序

## 12. 装配层：`buildRetrievedContext()`

候选和 rerank 完成后，真正决定 `retrievedContext` 长什么样的是：

- `buildRetrievedContext()`

它会把 reranked 结果装成：

- `book`
- `outlines`
- `recentChapters`
- 六类实体组
- `hardConstraints`
- `softReferences`
- `priorityContext`
- `retrievalObservability`
- `recentChanges`
- `riskReminders`

也就是说，retrieval 链路最终目标不是“找一堆相关实体”，而是“生成一份可直接给后续阶段共享的上下文对象”。

## 13. `hardConstraints` 是怎么来的

`buildHardConstraints()` 会从每类实体组里挑出最值得当作硬约束的那部分。

当前规则核心是：

- 手工指定实体优先
- 强关键词命中且带关键状态字段的实体优先
- continuity risk 高的实体优先
- 高分实体优先
- 不够填满时会按原排序补齐剩余名额

不同实体类型有不同保留逻辑，比如：

- 人物更看重 `current_location / goal / background`
- 物品更看重 `owner / status`
- 世界设定更看重规则类活跃内容

## 14. `priorityContext` 是怎么来的

`buildPriorityContext()` 不是简单复制实体列表，而是会：

- 先把 hard/soft 候选转成 fact packets
- 去重
- 做优先级分类
- 再进行 relation context 传播

最终得到四层：

- `blockingConstraints`
- `decisionContext`
- `supportingContext`
- `backgroundNoise`

当前这一步还会被 observability 复用，额外记录：

- 每个 packet 最终落入哪个 bucket
- 是按哪些已有规则信号被分进这个 bucket 的

这层的意义是：

- 不只是告诉模型“有哪些事实”
- 还告诉模型“哪些事实更应该先看”

当前这一步还会额外接入 persisted sidecar packet：

- `retrieval_facts` 会被转成 persisted fact packets
- `story_events` 会被转成 persisted event packets

这些 packet 会继续参与：

- bucket 分类
- 去重合并
- prompt 层 priority block 消费
- observability 中的 `surfacedIn` 解释

## 15. `riskReminders` 和 `recentChanges` 是怎么来的

### 15.1 `riskReminders`

`buildRiskReminders()` 会根据：

- 邻近钩子
- 最近章节窗口
- 人物位置
- 关键物品归属/状态
- 世界规则

生成一组自然语言风险提醒。

这层不是召回候选本身，而是：

- 连续性防错提示层

同时当前还会额外接入 persisted sidecar：

- 高风险 persisted facts 会转成显式 reminder
- 带 `unresolvedImpact` 的 story events 会转成显式 reminder

因此当前 `riskReminders` 已经不再只来自实时实体候选，也会直接承接前文章节沉淀下来的剧情状态。

### 15.2 `recentChanges`

`buildRecentChanges()` 会把：

- 最近章节摘要
- 风险提醒
- 高优先实体状态变化
- persisted facts
- persisted story events

再压成一层更适合 prompt 消费的近期变化视图。

并且这些项当前已经支持 provenance：

- `sourceRef`
- `sourceRefs`

## 16. 工厂层：`createPlanningRetrievalService()`

retrieval 服务不是直接 new 出来的，而是通过工厂创建。

这样做是为了统一处理：

- embedding 是否启用
- 使用哪种 embedding provider
- 使用 basic 还是 hybrid search mode

当前如果开启 embedding，工厂会：

- 从数据库加载 `characters / factions / items / hooks / relations / world_settings`
- 刷新 embedding 文档
- 读取索引文档
- 构造 searcher
- 把 searcher 注入 `RetrievalQueryService`

当前在线接线的 embedding 实体范围是：

- `character`
- `faction`
- `item`
- `hook`
- `relation`
- `world_setting`

## 17. 为什么 retrieval 只发生在 `plan`

这是当前架构最关键的设计点之一。

如果每个阶段都重新 retrieval，会出现两个问题：

- 同一章在不同阶段看到的事实边界不一致
- 多次生成后上下文容易漂移

现在的设计是：

- 只有 `plan` 做 retrieval
- 然后把 `retrievedContext` 固化到 `chapter_plans`
- `draft / review / repair / approve` 全部复用这份上下文

这样做的价值是：整条工作流共享同一份事实基线，prompt 行为更稳定，问题也更容易追踪和解释。

## 18. 两次 retrieval 在 `plan` 里的位置

严格说，retrieval 主链会在 `plan` 里调用两次：

### 18.1 第一次

输入：

- `keywords=[]`
- `manualRefs`

用途：

- 为 author intent 生成提供轻量上下文

### 18.2 第二次

输入：

- `keywords=buildRetrievalQueryPayload(...)` 生成的 retrieval keywords
- `manualRefs`

用途：

- 生成真正会被持久化和复用的共享 `retrievedContext`

这里已经不再是“原样使用 `extractedIntent.keywords`”，而是会把：

- `intentSummary`
- `mustInclude`
- `keywords`

一起压成更接近检索语言的 query payload，再送进第二次 retrieval。

## 19. 一个完整例子：从 `plan` 输入到最终 Prompt

下面用一个贴近当前实现与测试数据的例子，把 `plan` 阶段从输入到最终 prompt 的全过程串起来。

### 19.1 场景

假设当前要规划：

- 书籍：`青岳入门录`
- 章节：第 `11` 章
- 作者意图：`让林夜带着黑铁令进入青岳宗外门，承接旧案线索，并埋下执事核验的压力。`

库中已经存在：

- 人物：`林夜`
  - `current_location=山门外`
  - `goal=查清黑铁令来历`
- 势力：`青岳宗`
- 物品：`黑铁令`
  - `owner_type=character`
  - `owner_id=林夜`
- 钩子：`黑铁令旧案`
  - `target_chapter_no=11`
- 关系：`林夜 -> 青岳宗`
  - `relation_type=member`
- 世界设定：`外门登记核验规则`
- persisted sidecar：
  - `retrieval_facts`：`黑铁令旧案尚未收束`
  - `story_events`：`执事档案库再次提起旧案，仍需确认副令来源`

### 19.2 中文时序图

```mermaid
sequenceDiagram
    participant CLI as CLI / 用户输入
    participant WF as PlanChapterWorkflow
    participant Factory as createPlanningRetrievalService
    participant Service as RetrievalQueryService
    participant Rule as RuleBasedCandidateProvider
    participant Embed as EmbeddingCandidateProvider
    participant Rerank as RetrievalReranker
    participant Sidecar as Persisted Facts / Events
    participant Builder as buildRetrievedContext
    participant Blocks as buildPromptContextBlocks
    participant Prompt as buildPlanPrompt
    participant LLM as LLM

    CLI->>WF: plan(bookId, chapterNo, authorIntent, manualRefs)
    WF->>Factory: createPlanningRetrievalService(bookId)
    Factory-->>WF: retrievalService

    WF->>Service: retrievePlanContext(keywords=[], queryText="")
    Service->>Rule: loadCandidates()
    Rule-->>Service: 初始规则候选
    Service->>Rerank: rerank()
    Rerank-->>Service: 轻量重排结果
    Service->>Sidecar: load persisted facts/events
    Sidecar-->>Service: 初始 sidecar 结果
    Service->>Builder: buildRetrievedContext()
    Builder-->>WF: initialContext

    alt 用户未传 authorIntent
        WF->>LLM: buildIntentGenerationPrompt(initialContext)
        LLM-->>WF: authorIntent 草案
    else 用户已传 authorIntent
        WF-->>WF: 直接使用用户输入
    end

    WF->>LLM: buildKeywordExtractionPrompt(authorIntent)
    LLM-->>WF: intentSummary / keywords / mustInclude / mustAvoid / entityHints / cues
    WF-->>WF: buildRetrievalQueryPayload()

    WF->>Service: retrievePlanContext(keywords, queryText)
    Service->>Rule: loadCandidates()
    Rule-->>Service: 规则候选
    opt 开启 embedding
        Service->>Embed: semantic search + merge candidates
        Embed-->>Service: embedding_support / embedding_match 候选
    end
    Service->>Rerank: rerank()
    Rerank-->>Service: 最终候选顺序
    Service->>Sidecar: load persisted facts/events
    Sidecar-->>Service: selected sidecar
    Service->>Builder: buildRetrievedContext()
    Builder-->>WF: retrievedContext

    WF->>Blocks: buildPromptContextBlocks(mode=plan)
    Blocks-->>Prompt: mustFollowFacts / recentChanges / coreEntities / requiredHooks / forbiddenMoves / supportingBackground
    WF->>Prompt: buildPlanPrompt(retrievedContext)
    Prompt->>LLM: 最终 plan prompt
    LLM-->>WF: 章节规划正文
```

### 19.3 第一步：第一次轻量 retrieval

`PlanChapterWorkflow.run()` 里，先执行：

```ts
retrievePlanContext({
  bookId,
  chapterNo,
  keywords: [],
  queryText: "",
  manualRefs,
})
```

这一步不是为了生成最终共享上下文，而是为了给 author intent 生成提供最基本的背景。

此时主要会拿到：

- 当前章节附近的大纲
- 最近章节摘要
- 手工指定实体（如果有）
- 一批基础规则候选

### 19.4 第二步：把 author intent 压成 retrieval query

当 author intent 确定后，系统会先通过 `buildKeywordExtractionPrompt()` 提取：

- `intentSummary`
- `keywords`
- `mustInclude`
- `mustAvoid`
- `entityHints`
- `continuityCues`
- `settingCues`
- `sceneCues`

然后 `buildRetrievalQueryPayload()` 会把这些信息压成：

- `keywords`
- `queryText`

对这个例子，最终可能形成类似：

```txt
keywords:
林夜 / 黑铁令 / 青岳宗 / 外门 / 旧案 / 执事 / 核验 / 来历 / 入宗 / 登记

queryText:
林夜 黑铁令 青岳宗 外门 旧案 执事 核验 来历 入宗 登记 characters:林夜 factions:青岳宗 items:黑铁令
```

### 19.5 第三步：规则召回先打底

正式 retrieval 时，先由 `RuleBasedCandidateProvider` 拉规则候选。

对这个例子，规则召回大概率会命中：

- 人物：`林夜`
  - 因为命中 `name`、`goal`、`current_location`
- 势力：`青岳宗`
- 物品：`黑铁令`
- 钩子：`黑铁令旧案`
  - 且 `target_chapter_no=11`
- 关系：`林夜 -> 青岳宗`
- 世界设定：`外门登记核验规则`

这些候选会先被转成 `RetrievedEntity`，带上：

- `reason`
- `content`
- `score`

例如：

- `林夜`
  - `reason = keyword_hit+continuity_risk`
  - `score ≈ 80`
- `黑铁令旧案`
  - `reason = keyword_hit+chapter_proximity`
  - `score ≈ 60`
- `黑铁令`
  - `reason = keyword_hit+continuity_risk`
  - `score ≈ 55`

### 19.6 第四步：可选 embedding 补候选

如果开启了 embedding，`EmbeddingCandidateProvider` 会用：

- `queryText`
  - 若为空则退回 `keywords.join(" ")`

去做 semantic search。

它不会替代规则召回，而是只做两件事：

#### 已存在候选

如果某个实体原本就被规则召回命中了：

- 追加 `embedding_support`
- 小幅提高 `score`

例如：

- `青岳宗`
  - 原来：`score = 52`
  - semantic 支持后：`score = 59`
  - `reason = keyword_hit+institution_context+embedding_support`

#### 新补候选

如果某个实体规则没命中，但语义相关性很高：

- 会被补成 `embedding_match`
- 作为 embedding-only 候选加入候选池

### 19.7 第五步：本地 heuristic rerank

如果 `PLANNING_RETRIEVAL_RERANKER=heuristic`，会进入 `HeuristicReranker`。

它不是远程 API，而是本地启发式加分：

```txt
finalScore = baseScore + manualBoost + keywordBoost + embeddingBoost + continuityBoost + hookBonus
```

对这个例子：

#### 林夜

- `baseScore = 80`
- `keywordBoost = +15`
- `continuityBoost`
  - 因为内容里有 `current_location`、`goal` 等连续性强字段

所以林夜会被进一步抬高。

#### 黑铁令旧案钩子

- `baseScore = 60`
- `keywordBoost = +15`
- `hookBonus = +30`
  - 因为 `target_chapter_no=11`，与当前章节正好一致

所以它通常会进入前排。

#### 外门登记规则

- `baseScore = 48`
- `keywordBoost = +15`
- `continuityBoost`
  - 因为命中“规则/制度”
- 若是 `world_setting`，还有额外加成

这会让规则类世界设定在当前章更容易被顶到前面。

### 19.8 第六步：接入 persisted sidecar

正式 retrieval 里，除了实时候选，还会额外加载：

- `loadPersistedRetrievalFacts()`
- `loadPersistedStoryEvents()`

对这个例子：

- `retrieval_facts`
  - `黑铁令旧案尚未收束`
- `story_events`
  - `执事档案库再次提起旧案`
  - `unresolvedImpact = 仍需确认副令来源`

这些 sidecar 不是直接进 prompt，而是后面由 context builder 收口到派生层。

### 19.9 第七步：`buildRetrievedContext()` 收口

最后由 `buildRetrievedContext()` 把这些东西一起收口成：

- `hardConstraints`
- `softReferences`
- `priorityContext`
- `riskReminders`
- `recentChanges`
- `retrievalObservability`

对这个例子，可能形成：

#### `hardConstraints`

- 林夜当前位置/目标
- 黑铁令归属状态
- 林夜与青岳宗的成员关系
- 外门登记核验规则
- 当前章要回收的旧案钩子

#### `priorityContext.blockingConstraints`

- 林夜
- 黑铁令
- 黑铁令旧案钩子
- `第8章事实：黑铁令旧案尚未收束`
- `第9章事件：仍需确认黑铁副令来源`

#### `priorityContext.decisionContext`

- 青岳宗
- 入宗关系
- 外门制度

#### `riskReminders`

- 注意承接既有事实：黑铁令旧案尚未收束
- 注意未收束事件：仍需确认黑铁副令来源
- 人物当前位置连续性不可丢
- 关键物品持有者与状态不可漂移
- 已激活世界规则需要承接

#### `recentChanges`

- 近期章节：林夜持黑铁令来到山门外
- retrieval_fact：旧案尚未收束
- story_event：执事重新提起旧案
- risk_reminder：副令来源仍需核验

### 19.10 第八步：压成最终 plan prompt 可读块

在 `buildPlanPrompt()` 之前，系统会先执行：

```ts
buildPromptContextBlocks(retrievedContext, { mode: "plan" })
```

它会把大上下文压成 6 个固定区块：

- `mustFollowFacts`
- `recentChanges`
- `coreEntities`
- `requiredHooks`
- `forbiddenMoves`
- `supportingBackground`

最终 plan prompt 里，模型会看到这些 section：

- `章节信息`
- `作者意图`
- `意图约束`
- `本章必须遵守的事实`
- `最近承接的变化`
- `本章核心人物/势力/关系`
- `必须推进的钩子`
- `禁止改写与禁止新增`
- `补充背景`
- `召回上下文（必须严格参考）`
- `输出要求`

其中 `召回上下文（必须严格参考）` 不是整包原始 JSON，而是一个 compact 视图，用来兜底关键事实块。

### 19.11 一句话理解这个例子

这个例子里，模型最后真正看到的重点不是“数据库原始行”，而是：

- **意图层**：林夜入宗、旧案承接、执事核验压力
- **约束层**：人物位置、物品归属、宗门规则、旧案未收束、事件未收尾
- **推进层**：当前章必须推进旧案钩子
- **背景层**：青岳宗外门环境与相关大纲

也就是说，`plan` 阶段真正做的不是“查一堆数据给模型”，而是：

> 先用规则召回打底，再用 embedding 补语义候选，再用本地 heuristic rerank 调顺序，最后把实时候选和 persisted facts/events 一起收口成可直接进入 prompt 的分层上下文。

## 20. 当前实现特征

- 默认稳定主链仍是规则式 retrieval
- embedding 只做实验候选补充
- embedding 现在既能补缺失候选，也能给已命中候选追加 semantic support
- rerank 是可插拔层，不强绑到主链
- context builder 是 retrieval 和 workflow/prompt 之间的边界层
- `retrievedContext` 的目标是共享上下文，而不是一次性搜索结果
- `retrievedContext` 现在还会带一份可选的 `retrievalObservability`，用于解释来源、hard constraint 命中与 priority bucket 去向
- persisted sidecar 已经接入 `plan` 主链，当前重点消费 `retrieval_facts` 与 `story_events`
- `riskReminders / recentChanges / priorityContext` 已支持 provenance 与 `sourceRef/sourceRefs`
- persisted selection funnel 已可观测：可追踪 considered / selected / dropped / surfacedIn

## 21. 推荐阅读顺序

建议按下面顺序阅读：

1. `docs/retrieval-pipeline-guide.md`
2. `docs/retrieval-scoring-rules.md`
3. `docs/prompt-retrieval-relationship.md`
4. `docs/plan-workflow-guide.md`

## 相关阅读

- [`docs/retrieval-scoring-rules.md`](./retrieval-scoring-rules.md)
- [`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
- [`docs/plan-workflow-guide.md`](./plan-workflow-guide.md)
- [`docs/embedding-rerank-architecture.md`](./embedding-rerank-architecture.md)
- [`docs/retrieval-sidecar-provenance-guide.md`](./retrieval-sidecar-provenance-guide.md)

## 阅读导航

- 上一篇：[`docs/database-relationship-overview.md`](./database-relationship-overview.md)
- 下一篇：[`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
