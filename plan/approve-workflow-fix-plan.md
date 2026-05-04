# Approve 工作流完整修复设计

## 1. 背景

当前 `approve` 工作流已经具备完整主链：

- 读取 `current_plan / current_draft / current_review`
- 生成 final 正文
- 抽取结构化 diff
- 在事务内回写实体、关系、章节正式稿与 sidecar
- 更新 `chapters.current_final_id`

对应主实现位于：

- `src/domain/workflows/approve-chapter-workflow.ts`

从整体结构上看，这条主线是成立的，尤其是“final 正文生成”和“approve diff 抽取”拆成两次 LLM 调用这一点是合理的。

但当前实现仍存在几类明显缺口：

1. sidecar 清理范围过宽，存在误删同章节其他产物的风险
2. retrieval facts 会记录未真实落库成功的 update
3. 缺少 approve 前的状态机约束
4. 缺少跨书归属校验与实体存在性校验闭环
5. `update_fields` 允许模型直接透传任意字段到底层 update payload
6. 重复 approve 的幂等性和 notes 去重策略仍不清晰
7. 并发 approve 下的 version 竞争处理较弱

这份方案的目标不是改变 approve 的主链，而是：

- 保留现有 workflow 结构
- 补齐数据一致性与业务边界
- 明确 sidecar 生命周期
- 收敛 LLM diff 对数据库写入的影响面

---

## 2. 总目标

本次修复聚焦以下目标：

1. **只让 approve 改当前章节、当前书的合法数据**
2. **让 sidecar 始终反映“真实提交结果”，而不是模型原始意图**
3. **让 approve 的状态机边界明确可控**
4. **让 entity update 从“模型自由 patch”收敛为“受控字段映射”**
5. **让重复 approve 和并发 approve 的行为可预测**
6. **保持现有 CLI / workflow 接口不变，尽量做内部收口**

---

## 3. 非目标

本轮不做以下事情：

- 不改动 `approve` 的 CLI 参数设计
- 不改动 `approve diff` 的核心 prompt 任务定义
- 不新增新的工作流阶段
- 不引入新的基础设施（消息队列、分布式锁、外部幂等键服务等）
- 不重写整个 sidecar 数据模型

---

## 4. 当前 approve 的职责拆解

当前 `approve` 可以分为 6 个阶段：

### 4.1 前置读取与 pointer 校验

- 读取当前章节
- 校验 `current_plan_id / current_draft_id / current_review_id`
- 读取 plan / draft / review 正文与上下文

### 4.2 两段式模型调用

- `high` 档模型生成 final 正文
- `low` 档模型从 final 正文中抽取结构化 diff

### 4.3 事务内再次校验 pointer

- 防止模型生成期间 `current_*` 指针被并发修改

### 4.4 设定库实体与关系回写

- 复用或创建 character / faction / item / hook / world_setting / relation
- 应用 `diff.updates`

### 4.5 正式稿版本提交

- 创建 `chapter_finals`
- 更新 `chapters.current_final_id`
- 更新 `chapters.summary / actual_*_ids / status`

### 4.6 retrieval sidecar 重建

- 清理旧 approved sidecar
- 生成 `story_events`
- 生成 `chapter_segments`
- 生成 `retrieval_documents`
- 生成 `retrieval_facts`

这 6 个阶段本身没有问题；当前需要修的是它们之间的约束与边界。

---

## 5. 关键问题与修复设计

## 5.1 问题一：sidecar 清理范围过宽

### 当前问题

当前 `clearApproveSidecarArtifacts()` 的删除口径不一致：

- `retrieval_documents` 按 approve chunk key 精确删除
- `story_events` 按 `book_id + chapter_id` 整章删除
- `chapter_segments` 按 `book_id + chapter_id` 整章删除
- `retrieval_facts` 按 `book_id + chapter_no` 整章删除

这样会带来两个问题：

1. 如果后续同章节接入了非 approve 的 sidecar 产物，这里会误删
2. 当前不同 sidecar 表的删除口径不一致，生命周期难以推断

### 修复目标

让 approve 只清理“自己生成的 approved sidecar 产物”，不碰同章节其他来源的数据。

### 设计方案

#### 方案 A：基于来源字段精确清理（推荐）

统一让 approve 产物带可识别来源标记：

- `story_events.trigger_text = approve:<finalId>` 已存在，可继续作为来源锚点
- `chapter_segments.source_type = approved` 已存在，可继续使用
- `retrieval_documents.chunk_key` 已带 `:approved`
- `retrieval_facts` 新增/复用 payload 字段写入 `sourceType=approved`、`finalId`、`storyEventId`

清理策略改为：

- 先查出当前章节历史上 approve 生成的 `story_event` id 集合
- 只删除这些 event 关联的 `retrieval_documents`
- 只删除 `source_type=approved` 的 `chapter_segments`
- 只删除 payload / fact_key 明确属于 approve sidecar 的 `retrieval_facts`
- 只删除 `trigger_text like 'approve:%'` 且属于当前章节的 `story_events`

#### 方案 B：按 finalId 串联 sidecar（更强，但改动稍大）

如果允许补字段，建议为 sidecar 相关表增加 `source_final_id`，那么删除逻辑可直接精确到某个 final 版本。

### 推荐结论

本轮优先使用**方案 A**，不改 schema 或尽量少改 schema，先把删除范围收窄。

---

## 5.2 问题二：retrieval facts 记录了未真实应用的 updates

### 当前问题

当前 `diff.updates` 中若某条 update 指向的实体不存在：

- 事务里会跳过该 update
- 但后续 `persistApproveRetrievalFacts()` 仍然使用全量 `diff.updates`

结果就是：

- 实体表没有真的更新
- retrieval_facts 却记录了“该变更发生了”

这会让 sidecar 与实体层产生分叉。

### 修复目标

retrieval sidecar 必须只反映**真实提交结果**，而不是模型的原始意图。

### 设计方案

在 approve 事务内引入 3 组中间结果：

- `appliedUpdates`
- `skippedUpdates`
- `createdOrReusedEntities`

其中：

- `appliedUpdates`：真实更新成功的 update
- `skippedUpdates`：因实体不存在、跨书、非法字段、非法状态等原因被丢弃的 update
- `createdOrReusedEntities`：本次 approve 复用或创建成功的实体结果

后续：

- `updatedCount` 来自 `appliedUpdates.length`
- 日志记录 `skippedUpdates`
- `persistApproveRetrievalFacts()` 只消费 `appliedUpdates`

### 扩展建议

返回值里可以考虑增加：

- `appliedUpdateCount`
- `skippedUpdateCount`

这样 CLI 和日志都更一致。

---

## 5.3 问题三：缺少 approve 前的状态机约束

### 当前问题

当前 approve 只要求：

- 有 current plan
- 有 current draft
- 有 current review

但没有约束 chapter 当前 `status` 必须处于可 approve 状态。

这会导致：

- 理论上只要指针齐，就可以从不合理状态直接 approve
- workflow 的状态机和数据指针语义松耦合

### 修复目标

让 `approve` 只能发生在业务允许的阶段。

### 设计方案

在 `ApproveChapterWorkflow.run()` 的前置校验中新增：

允许 approve 的状态集合：

- `CHAPTER_STATUS.REVIEWED`
- `CHAPTER_STATUS.REPAIRED`

拒绝状态：

- `TODO`
- `PLANNED`
- `DRAFTED`
- 已损坏或未知状态

### 行为建议

- 如果 status 不在允许集合中，直接抛业务错误
- 错误文案要明确是“当前章节状态不允许 approve”，而不是笼统地说 pointer invalid

---

## 5.4 问题四：缺少跨书归属校验

### 当前问题

当前 update 和 relation 创建主要依赖 `id` 与 `entityType`，缺少下面两类校验：

1. 更新目标是否属于当前书
2. relation 端点实体是否存在且属于当前书

这意味着如果 LLM 输出了其他书的实体 ID，当前书的 approve 可能污染别的书的数据。

### 修复目标

approve 必须只影响 `payload.bookId` 下的数据。

### 设计方案

#### 对 `diff.updates`

在每个 update 应用前做：

- `existing != null`
- `existing.book_id === payload.bookId`

若不满足：

- 记录 `skippedUpdates`
- reason 设为 `entity_not_found` 或 `cross_book_reference`

#### 对 `newRelations`

在 create / reuse relation 前新增：

- 校验 `sourceType/sourceId` 对应实体存在
- 校验 `targetType/targetId` 对应实体存在
- 校验 source/target 的 `book_id === payload.bookId`
- 校验 source/target 的实体类型与 endpoint 类型一致

对于非法 relation：

- 跳过
- 记录 `skippedRelations`
- 不写 relation，也不把其纳入 actual entity refs

#### 对 `actual*Ids`

在写入 `chapters.actual_*_ids` 前，对合并后的 ids 做一次过滤：

- 是否存在
- 是否属于当前书

### 补充收益

这样可以把 `approve diff` 从“信任模型提供主键”改成“模型只提建议，由 workflow 做归属裁决”。

---

## 5.5 问题五：`update_fields` 缺少字段白名单

### 当前问题

当前 `mapEntityUpdate()` 对 `update_fields` 基本是：

- `return { ...payload, updated_at: timestamp }`

这意味着模型可以把任意字段带到底层 update patch：

- 可能改到不该改的字段
- 可能把 schema 内部字段暴露给 LLM 决策
- 可能导致 repository 层报错或产生脏写

### 修复目标

让 LLM 的 diff 只表达“业务意图”，真正的数据库字段写入由 workflow 做白名单映射。

### 设计方案

把当前统一的 `mapEntityUpdate()` 改成“按实体类型分发的受控映射”：

- `mapCharacterUpdatePayload()`
- `mapFactionUpdatePayload()`
- `mapItemUpdatePayload()`
- `mapRelationUpdatePayload()`
- `mapHookUpdatePayload()`
- `mapWorldSettingUpdatePayload()`

每个 mapper 只允许有限字段，例如：

#### character

允许：

- `background`
- `personality`
- `current_location`
- `status`
- `goal`
- `append_notes`

禁止：

- `id`
- `book_id`
- `created_at`
- 任意不在白名单内字段

#### faction

允许：

- `description`
- `core_goal`
- `leader_character_id`
- `status`
- `append_notes`

#### item

允许：

- `description`
- `owner_type`
- `owner_id`
- `status`
- `append_notes`

#### relation
n
允许：

- `description`
- `intensity`
- `status`
- `append_notes`

#### story_hook

允许：

- `description`
- `status`
- `target_chapter_no`
- `append_notes`

#### world_setting

允许：

- `content`
- `category`
- `status`
- `append_notes`

### 行为建议

- 非白名单字段直接丢弃
- 如果 payload 丢弃后为空，则跳过该 update
- 记 warn，reason=`no_allowed_fields`

---

## 5.6 问题六：重复 approve 的幂等性与 notes 去重不清晰

### 当前问题

当前重复 approve 的行为是：

- 继续创建新的 `chapter_final`
- 重新创建 approved sidecar
- 对同名复用实体重复追加 `[Chapter N] ...` note

这里分成两个子问题：

1. **版本语义问题**：重复 approve 是否应该生成新 final？
2. **副作用问题**：重复 approve 是否应该重复写 notes 和 sidecar？

### 设计判断

当前项目的数据模型是版本化的，`chapter_finals` 本来就允许一个章节存在多个 final 版本。

因此本轮不强制把 approve 改成“严格幂等，不再生成新 final”，否则会改变当前版本模型语义。

### 修复目标

保留“可重复 approve 生成新 final”的能力，但收敛副作用。

### 设计方案

#### 方案 A：保留新 final 版本，但去重 append notes（推荐）

扩展 `appendChapterNote()` 或新增 `appendChapterNoteOnce()`：

- 如果相同章节号、相同 note 文本已经存在，则不重复追加
- 只对 approve 这条链使用去重版本

#### 方案 B：基于 current final 做内容短路（可选）

如果满足：

- `current_final` 已基于相同 `current_draft_id`
- final content 完全一致
- diff 核心结构一致

则可直接短路，返回当前 final，不再生成新版本。

这会显著改变当前版本语义，因此建议作为可选增强，不作为本轮必做。

### 推荐结论

本轮只做：

- `append_notes` 去重
- sidecar 精确重建

不做严格 final 幂等。

---

## 5.7 问题七：并发 approve 的 version 竞争处理较弱

### 当前问题

当前 `chapter_finals.version_no` 依赖：

- `getLatestVersionNo(chapterId) + 1`

并发 approve 时，两边可能拿到同一个 version。

### 修复目标

让并发失败更可预测，而不是产生模糊异常。

### 设计方案

本轮不引入复杂锁，只做两件事：

1. 保持数据库唯一约束作为最终防线
2. 对 version 冲突异常做明确错误包装

例如：

- 捕获唯一键冲突
- 转换为可读错误：`Chapter final version changed during approve, please retry`

### 可选增强

如果后续并发场景增多，再考虑：

- chapter 级显式锁
- 或 version insert retry

当前 CLI 单用户主场景下，这不是最高优先级。

---

## 6. approve 新的内部数据流设计

本轮建议把 approve 事务内的中间结果收敛成更清晰的结构。

## 6.1 新的事务内上下文

建议引入类似结构：

```ts
interface ApproveMutationResult {
  createdEntities: {
    characters: number[];
    factions: number[];
    items: number[];
    hooks: number[];
    worldSettings: number[];
    relations: number[];
  };
  appliedUpdates: NormalizedApproveUpdate[];
  skippedUpdates: Array<{
    entityType: string;
    entityId: number;
    reason: string;
  }>;
  skippedRelations: Array<{
    sourceType: string;
    sourceId: number;
    targetType: string;
    targetId: number;
    reason: string;
  }>;
  actualEntityRefs: {
    characters: number[];
    factions: number[];
    items: number[];
    hooks: number[];
    worldSettings: number[];
  };
}
```

这样后续：

- `chapter` 主表更新
- `story_event` participant refs
- `retrieval_documents`
- `retrieval_facts`

都消费同一份“真实提交结果”，而不是再次拼凑。

---

## 6.2 sidecar 只消费真实提交结果

新的 sidecar 输入应来自：

- `actualEntityRefs`：经过存在性与归属过滤
- `appliedUpdates`：经过白名单与实体校验
- `finalRecord.id`
- `approvedStoryEvent.id`
- `approvedSegment.id`

禁止 sidecar 直接消费：

- 未过滤的 `diff.updates`
- 未过滤的 `diff.actual*Ids`
- 未校验的 `newRelations`

---

## 7. 具体修改范围建议

## 7.1 主要修改文件

### 核心 workflow

- `src/domain/workflows/approve-chapter-workflow.ts`

### 共享工具

- `src/domain/workflows/shared.ts`

### 如需补通用校验工具，可新增局部 helper

建议优先放在：

- `src/domain/workflows/approve-*` 同文件私有 helper
- 或拆成 `src/domain/workflows/approve-helpers.ts`

不建议现在把这套逻辑抽到过泛的 cross-workflow 层，因为当前问题主要集中在 approve。

---

## 7.2 approve 内推荐重构块

建议把当前大函数按职责拆成这些私有 helper：

- `assertApproveAllowedChapterState(chapter)`
- `validateAndResolveActualEntityRefs(...)`
- `applyApproveNewEntities(...)`
- `applyApproveRelations(...)`
- `applyApproveUpdates(...)`
- `buildApproveMutationResult(...)`
- `clearApprovedSidecarArtifacts(...)`
- `persistApprovedSidecar(...)`

目标不是为了“抽象漂亮”，而是让：

- 状态校验
- 归属校验
- update 应用
- sidecar 重建

各自有明确边界，避免继续堆在一个 transaction block 里。

---

## 8. 实施顺序

## Phase 1：先修 correctness

1. sidecar 清理范围收窄
2. retrieval_facts 改为只记录 `appliedUpdates`
3. chapter status allowlist 校验
4. `actual*Ids` 存在性与归属过滤

### 交付标准

- approve 不再误删同章节其他 sidecar
- sidecar 与实体落库一致
- 非法状态章节不能 approve
- 非当前书实体不会进入 actual refs

---

## Phase 2：补边界校验

1. `diff.updates` 跨书校验
2. `newRelations` 端点存在性、归属、类型校验
3. `skippedUpdates / skippedRelations` 结构化日志

### 交付标准

- approve 不会污染其他书的数据
- 非法 relation 不落库
- 所有 skip 都有明确 reason

---

## Phase 3：收敛 LLM 写入权限

1. 为各实体实现白名单 update mapper
2. update payload 为空时跳过
3. 对非法字段做 warn

### 交付标准

- 模型无法直接透传任意 patch 到 repository
- update 行为收敛为受控业务字段集合

---

## Phase 4：改善重复 approve 行为

1. `appendChapterNote` 去重或新增 `appendChapterNoteOnce`
2. sidecar 重建继续保持精确删除 + 精确重建
3. 可选：评估是否需要“同输入短路，不新建 final”

### 交付标准

- 重复 approve 不再重复堆叠相同 chapter note
- sidecar 重建可重复执行但结果稳定

---

## 9. 测试建议

## 9.1 单元/集成测试新增场景

### sidecar 清理

- 同章节存在非 approve 事件/片段/fact 时，approve 不应删掉它们
- approve 重跑时，只替换 approved sidecar 自己的产物

### applied/skipped updates

- diff 中混入不存在实体 update 时：
  - 真实实体不报错
  - skipped count 正确
  - retrieval_facts 只包含成功 update

### 状态校验

- `planned/drafted/todo` 状态不能 approve
- `reviewed/repaired` 可以 approve

### 跨书校验

- diff 引用其他书的 entityId 时：
  - 不更新
  - 不写入 actual refs
  - 不产生 relation

### 字段白名单

- 模型输出非法字段时：
  - 不落库
  - 不污染 repository update payload

### note 去重

- 同章节、同 note 文本重复 approve 时，不重复追加

---

## 9.2 回归测试重点

必须覆盖当前已有主链：

- `approve` 正常完成
- 生成 `chapter_final`
- 更新 `chapters.current_final_id`
- 写入 sidecar
- 下一轮 `plan` 可继续消费 approved sidecar

---

## 10. 最终建议

本轮最合理的策略不是重写 approve，而是：

- **保留现有两段式 LLM + 事务提交骨架**
- **把 workflow 从“信任 diff”升级成“审查 diff、过滤 diff、提交真实结果”**

一句话总结：

**approve diff 只能提供候选变更，真正能写进数据库和 sidecar 的内容，必须经过 workflow 的状态校验、归属校验、字段白名单和结果收敛。**

这样做以后，approve 的职责会更清晰：

- LLM 负责提出 final 和变更建议
- workflow 负责裁决哪些建议合法、哪些建议可写、哪些建议能进入长期记忆

这也是当前项目走向长期可维护时，approve 最需要补上的一层边界。
