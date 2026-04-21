# Retrieval sidecar 与 provenance 说明

本文专门说明这轮长篇检索升级里新增的 persisted sidecar 与 provenance 链路，重点回答这些问题：

- `approve` 结束后到底额外写了哪些 sidecar 数据
- `plan` 阶段如何把这些 sidecar 数据重新接入 retrieval
- `riskReminders / recentChanges / priorityContext` 里的来源信息从哪里来
- `surfacedIn / sourceRef / sourceRefs` 分别表达什么

如果你想看的是：

- retrieval 主链总体结构：看 [`docs/retrieval-pipeline-guide.md`](./retrieval-pipeline-guide.md)
- `plan` 工作流如何两次召回并固化上下文：看 [`docs/plan-workflow-guide.md`](./plan-workflow-guide.md)
- `approve` 工作流怎样生成 final 和 diff：看 [`docs/approve-workflow-guide.md`](./approve-workflow-guide.md)

## 目录

- [1. 一句话理解](#1-一句话理解)
- [2. sidecar 新增了什么](#2-sidecar-新增了什么)
- [3. 写入链路：`approve -> sidecar`](#3-写入链路approve---sidecar)
- [4. 读取链路：`plan <- sidecar`](#4-读取链路plan---sidecar)
- [5. sidecar 如何进入 prompt 消费层](#5-sidecar-如何进入-prompt-消费层)
- [6. provenance 解决了什么问题](#6-provenance-解决了什么问题)
- [7. 当前 provenance 结构](#7-当前-provenance-结构)
- [8. observability 如何解释 sidecar 去向](#8-observability-如何解释-sidecar-去向)
- [9. 当前实现边界](#9-当前实现边界)
- [相关阅读](#相关阅读)

## 1. 一句话理解

这轮升级把“章节推进过程中产生的结构化剧情状态”从临时 prompt 上下文，升级成了可持久化、可重用、可解释的 retrieval sidecar；然后再用 provenance 把这些 sidecar 信号接回 `plan`，并解释它们最终落到了哪一层 prompt 上下文里。

## 2. sidecar 新增了什么

当前新增的 sidecar 主要有四类：

- `retrieval_documents`
  - 保存 embedding 文档与索引载荷，服务于 embedding refresh / store / search
- `retrieval_facts`
  - 保存章节事实、章节摘要、结构化更新等更细粒度的长期检索资产
- `story_events`
  - 保存章节中的关键事件、摘要与 `unresolvedImpact`
- `chapter_segments`
  - 保存章节分段级文本片段，给后续更细粒度检索与分析预留基础

可以把它们理解为两层：

- `retrieval_documents`
  - 偏 embedding / 索引层 sidecar
- `retrieval_facts / story_events / chapter_segments`
  - 偏剧情状态 / continuity 层 sidecar

## 3. 写入链路：`approve -> sidecar`

当前 `approve` 不再只是：

- 生成 final 正文
- 抽取 diff
- 回写设定库

它还会继续把 diff 和章节内容沉淀成 sidecar。

### 3.1 当前已经写入的内容

- `retrieval_documents`
  - 供 embedding 检索与 refresh 使用
- `retrieval_facts`
  - 最小已覆盖：`chapter_summary` 与若干 `*_update` facts
- `story_events`
  - 关键事件与其 `unresolvedImpact`
- `chapter_segments`
  - 章节片段级 sidecar

### 3.2 这一步的价值

这意味着一章写完之后，系统留下的不只是：

- 一条 final 正文
- 一批设定库字段更新

还会留下：

- 后续章节 planning 可以继续召回的剧情状态资产

也就是说，系统开始从“每章重新拼上下文”转向“随着章节推进不断积累记忆”。

## 4. 读取链路：`plan <- sidecar`

当前 `plan` 第二次正式 retrieval，除了规则候选、可选 embedding 补候选与 rerank 之外，还会额外读取 persisted sidecar。

当前重点接入的是：

- `retrieval_facts`
- `story_events`

### 4.1 它们会进入哪些派生视图

当前 sidecar 信号已经能进入：

- `riskReminders`
- `recentChanges`
- `priorityContext`
- prompt context blocks

### 4.2 这意味着什么

现在 `plan` 看到的上下文不再只是：

- 设定库实体
- 最近章节摘要
- 当前章节相关大纲

还会额外看到：

- 前文已经沉淀出来的重要事实
- 尚未收束的剧情事件
- 带显式来源的连续性提醒

这对长篇最直接的帮助是：

- 更不容易忘前文
- 更容易承接老伏笔和未收束事件
- 更容易把“剧情状态”而不是单纯“实体介绍”带进下一章 planning

## 5. sidecar 如何进入 prompt 消费层

当前 sidecar 不是直接整包 JSON 塞进 prompt，而是先进入 `retrievedContext` 的分层结构，再由 `prompt-context-blocks.ts` 转成更可读的事实块。

也就是先进入：

- `hardConstraints`
- `priorityContext`
- `riskReminders`
- `recentChanges`

然后再按阶段裁剪成：

- `plan`
- `draft`
- `review`
- `repair`
- `approve`
- `approveDiff`

各自的可消费上下文块。

这让 sidecar 的价值不只是“被查出来”，而是“真的进入了模型在意的那一层上下文”。

## 6. provenance 解决了什么问题

一旦 sidecar 真正进入 planning 链路，系统马上会遇到一个问题：

> 某条提醒、某个 packet、某条 recent change，究竟来自哪条 persisted fact / event？

provenance 解决的就是这个解释问题。

它带来的收益包括：

- 可解释性
  - 能说明某条上下文为什么出现
- 可调试性
  - 能反查“没选中”或“选中了但落到了哪一层”
- 可维护性
  - reminder / change / packet 共用统一 provenance 规则，而不是各自手写
- 兼容性
  - 新旧 `retrieved_context` 读取时都能归一化

## 7. 当前 provenance 结构

当前 shared helper 主要收敛在：

- `src/domain/planning/provenance.ts`

核心结构与字段包括：

- `sourceRef`
  - 单一主来源，通常作为 canonical primary ref
- `sourceRefs`
  - 多来源集合，支持 merge / dedupe 后保留完整来源链

当前已覆盖的对象包括：

- `RetrievedRiskReminder`
- `RetrievedRecentChange`
- `RetrievedFactPacket`（也就是 `priorityContext` packet）

### 7.1 当前已经统一的路径

- builder path
  - persisted packet 创建时统一走 provenance helper
- dedupe path
  - packet merge 后会保留并归一化 `sourceRefs`
- attribution path
  - `hasPersistedSourceRef(...)` 用于判断某条 sidecar 最终 surfacing 到了哪层
- read/compat path
  - `context-views.ts` 在读取旧/新 `retrieved_context` 时会对 provenance 结构做归一化

## 8. observability 如何解释 sidecar 去向

这轮升级里，persisted sidecar 选择过程也已经进入 observability。

当前可以追踪：

- 哪些 facts/events 被考虑过
- 哪些被选中
- 哪些被丢弃
- 被丢弃的原因是什么
- 最终 `surfacedIn` 到了哪里

当前 `surfacedIn` 主要覆盖：

- `blockingConstraints`
- `decisionContext`
- `riskReminders`
- `recentChanges`

这意味着当某条 persisted fact 没有进入 prompt 时，可以继续往下查：

- 是没匹配到
- 还是被 top-k 截断了
- 还是进入了 sidecar 选择，但最后没进入 prompt 的关键层

## 9. 当前实现边界

当前这轮已经完成的是：

- sidecar 表结构与 repository
- `approve` 写 sidecar
- `plan` 读 persisted facts/events
- sidecar 进入 `riskReminders / recentChanges / priorityContext / prompt blocks`
- packet/reminder/change 的 provenance 统一化
- `surfacedIn` 与 selection trace 可观测性

当前还没有完全做满的方向，更偏后续增强：

- 更细粒度的 `chapter_segments` 消费策略
- 更强的事件演化与多章节状态机建模
- 更深入的 sidecar ranking / trimming / budget-aware prompt 消费

## 相关阅读

- [`docs/retrieval-pipeline-guide.md`](./retrieval-pipeline-guide.md)
- [`docs/plan-workflow-guide.md`](./plan-workflow-guide.md)
- [`docs/approve-workflow-guide.md`](./approve-workflow-guide.md)
- [`docs/prompt-retrieval-relationship.md`](./prompt-retrieval-relationship.md)
- [`docs/database-relationship-overview.md`](./database-relationship-overview.md)
