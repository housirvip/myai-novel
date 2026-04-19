# 长篇检索升级第一阶段执行清单（Phase 0 + Phase 1）

> 对应文档：
> - `plan/longform-retrieval-v4.md`
> - `plan/longform-retrieval-v4-tasks.md`

这份文档只覆盖**第一阶段可立即开工的执行切片**。它刻意不进入 schema 重构、persistent retrieval corpus、fact/event/chapter-segment 建模，而是先把现有 retrieval 栈拉到一个更适合长篇小说的基线。

核心原则：

1. 先补 benchmark 与 observability
2. 先把现有参数与规则召回容量拉高
3. 保持 `retrieved_context` 兼容
4. 暂不引入 migration 和大规模结构升级

---

## 这一阶段的目标

第一阶段的目标不是“彻底解决长篇问题”，而是先解决下面四件事：

1. 让系统能**量化暴露**长篇检索问题
2. 让系统能**解释**为什么没召回出来
3. 让系统在现有架构下获得**更高的容量上限**
4. 为后续结构升级准备一套更可靠的 baseline

---

## 本阶段明确不做的内容

为了控制风险，下面这些全部延后到后续阶段：

1. `retrieval_documents`
2. `retrieval_facts`
3. `story_events`
4. `chapter_segments`
5. 持久化 embedding / retrieval storage
6. backfill / refresh 重构
7. dual-read / dual-write 开关
8. prompt assembly 的分层大改
9. fact-level / event-level 检索主链改造

换句话说：**本阶段只强化现有系统，不改系统本质。**

---

## 执行任务 1：扩展长篇 benchmark

### 目标

为当前 retrieval 系统增加面向长篇小说的测试样本，建立更真实的压力面。

### 具体任务

1. 在现有 benchmark fixture 体系中增加长篇向样本，而不是新造一套 benchmark 系统。
2. 至少补以下几类 fixture：
   - 长距离连续性召回
   - 章节跨度很大的 callback 回收
   - 人物动机连续性
   - 世界规则重新浮现
   - 同主题高密度实体歧义
   - 最近章节承接不足问题
3. 对当前已知不足但暂不修的样本，可以用 `baseline_gap` 或类似方式标记，保留为后续阶段目标。

### 可能涉及的文件

- `test/fixtures/retrieval-benchmark/*.json`
- `test/helpers/retrieval-benchmark.ts`
- `test/integration/retrieval-benchmark.test.ts`

### 验证方式

```bash
./node_modules/.bin/tsx --test test/integration/retrieval-benchmark.test.ts
```

### 完成标准

1. benchmark 能覆盖长篇常见失败场景。
2. 现有严格样本仍然保持通过。
3. 新增样本可以清晰区分“当前只是容量不足”还是“架构已经不够”。

---

## 执行任务 2：扩展 retrieval observability

### 目标

在不重写 observability 体系的前提下，让 planning retrieval 的行为更透明。

### 具体任务

1. 扩展当前 `retrievalObservability` payload。
2. 增加以下指标：
   - `queryText` 长度
   - rerank 前候选数量
   - rerank 后候选数量
   - hard-constraint kept / dropped counts
   - priority bucket counts
   - recent chapter scanned vs kept
   - embedding-only count
   - embedding-support count
3. 如果当前链路成本可控，再增加：
   - prompt section budget usage

### 可能涉及的文件

- `src/domain/planning/retrieval-observability.ts`
- `src/domain/planning/retrieval-context-builder.ts`
- `src/domain/planning/retrieval-service.ts`
- `src/domain/planning/types.ts`
- `test/integration/retrieval-benchmark.test.ts`
- `test/integration/env-and-logging.test.ts`

### 验证方式

```bash
./node_modules/.bin/tsx --test test/integration/retrieval-benchmark.test.ts test/integration/env-and-logging.test.ts
npm run check
```

### 完成标准

1. 观察日志能回答“候选为什么没进最终上下文”。
2. 观察日志能区分规则召回与 embedding 增强的贡献。
3. 为后续 Phase 2+ 的结构升级预留对比基线。

---

## 执行任务 3：通过 env / docs 暴露长篇 preset

### 目标

不引入新的 profile 系统，直接在现有 env 模型下暴露长篇起始参数。

### 建议参数（起始值）

```dotenv
PLANNING_RETRIEVAL_ENTITY_SCAN_LIMIT=1500
PLANNING_RETRIEVAL_CHARACTER_LIMIT=32
PLANNING_RETRIEVAL_FACTION_LIMIT=20
PLANNING_RETRIEVAL_ITEM_LIMIT=20
PLANNING_RETRIEVAL_HOOK_LIMIT=24
PLANNING_RETRIEVAL_RELATION_LIMIT=32
PLANNING_RETRIEVAL_WORLD_SETTING_LIMIT=20
PLANNING_RETRIEVAL_RECENT_CHAPTER_LIMIT=8
PLANNING_RETRIEVAL_RECENT_CHAPTER_SCAN_MULTIPLIER=12
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC=32
PLANNING_RETRIEVAL_EMBEDDING_LIMIT_HYBRID=40
```

### 具体任务

1. 在 `env.ts` 中补充 / 校准参数。
2. 在 `.env.example` 中补充 long-form 推荐值。
3. 在文档中明确说明：
   - 这是**容量扩展**，不是结构升级；
   - 可以减轻失真，但不能根治“一实体一文档”的问题。

### 可能涉及的文件

- `src/config/env.ts`
- `.env.example`
- `docs/env-config-guide.md`
- 可选：`docs/retrieval-scoring-rules.md`

### 验证方式

```bash
npm run check
npm run build
```

### 完成标准

1. 项目可以显式切换到更适合长篇的参数。
2. 文档说明清楚，不会让人误以为 Phase 1 已经解决结构问题。

---

## 执行任务 4：校准当前规则召回与承接窗口

### 目标

基于 benchmark 和 observability 结果，调整当前 rule retrieval 的上限，而不是盲目一把梭把所有数字拉满。

### 具体任务

1. 调高 `ENTITY_SCAN_LIMIT`
2. 调整每类实体的 top-K：
   - characters
   - factions
   - items
   - hooks
   - relations
   - world settings
3. 调整 recent chapter scan window 与 keep window
4. 检查 larger candidate pool 下，hard-constraints 是否过于激进

### 可能涉及的文件

- `src/domain/planning/retrieval-candidate-provider-rule.ts`
- `src/config/env.ts`
- `src/domain/planning/retrieval-hard-constraints.ts`
- `test/domain/planning/retrieval-hard-constraints.test.ts`
- `test/integration/retrieval-benchmark.test.ts`

### 重要约束

1. 不改 `retrieved_context` 形状
2. 不引入 migration
3. 不引入新的 retrieval layer

### 验证方式

```bash
./node_modules/.bin/tsx --test test/integration/retrieval-benchmark.test.ts test/domain/planning/retrieval-hard-constraints.test.ts
npm run check
npm run build
```

### 完成标准

1. 现有 retrieval 在长篇场景下不再过早因为小上限而失真。
2. 候选池变大后，排序和硬约束仍然稳定。

---

## 执行任务 5：冻结 Phase 0 / Phase 1 边界

### 目标

在这一切改完之后，明确确认：第一阶段已经完成，但更深层的问题仍然延后。

### 具体任务

1. 回归验证现有 retrieval service 测试
2. 回归验证 prompt context 相关测试
3. 回归验证 env / logging 测试
4. 跑全量测试
5. 记录“本阶段已解决 / 未解决”的边界说明

### 可能涉及的验证面

- `test/integration/retrieval-benchmark.test.ts`
- `test/integration/retrieval-service.test.ts`
- `test/domain/planning/prompt-context-blocks.test.ts`
- `test/integration/env-and-logging.test.ts`

### 验证方式

```bash
npm run check
npm run build
npm test
```

### 完成标准

1. benchmark 范围变广
2. observability 能解释更多失败原因
3. 长篇参数路径已暴露
4. 规则召回不会因为短篇参数过小而过早失败
5. 未提前引入 schema 和持久化复杂度

---

## 推荐提交顺序

如果要分多次 commit，建议顺序如下：

1. `test(retrieval): 增加长篇 benchmark fixture 与评估覆盖`
2. `feat(retrieval): 扩展 retrieval observability 指标`
3. `feat(config): 增加 long-form retrieval 参数说明与模板`
4. `tune(retrieval): 提高 scan limit 与 chapter carryover`
5. `test(retrieval): 校准第一阶段回归测试`

---

## 建议实际开工顺序

真正执行时，我建议按下面顺序做：

1. 先补 benchmark
2. 再补 observability
3. 再暴露 env / docs
4. 再调 retrieval limit
5. 最后全量验证并锁定边界

原因很直接：

- 没 benchmark，后面调参数就会变成拍脑袋；
- 没 observability，后面调参数就不知道错在哪；
- 先把测量面搭好，再扩容，收益最大。

---

## 第一阶段完成定义

只有当下面这些都成立时，Phase 0 + Phase 1 才算完成：

1. 新增长篇 benchmark 已落地
2. retrieval observability 已扩展
3. long-form 参数已暴露并文档化
4. 当前规则召回与 recent chapter carryover 已完成一轮校准
5. `retrieved_context` 兼容性未被破坏
6. 全量测试通过

---

## 这一阶段完成后，下一步该做什么

第一阶段完成后，不建议继续只靠“再加大 top-K”往前推。下一步应直接进入：

1. `retrieval_documents`
2. `retrieval_facts`
3. `story_events`
4. `chapter_segments`

也就是：从“扩容量”进入“改结构”。
