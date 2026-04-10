# AI 小说工具 V1 数据表设计

## 1. 说明

本文档从 [v1.md](/Users/housirvip/codex/myai-novel/plan/v1.md) 中拆分出所有数据表设定，专门用于数据库设计、迁移编写和 repository 实现。

V1 推荐采用：

- `chapters` 作为章节主表
- `chapter_plans`、`chapter_drafts`、`chapter_reviews` 作为过程表
- `final_content` 仍保留在 `chapters`

## 2. 通用约定

### 2.1 主键与时间字段

- 所有表主键统一为 `id`
- 时间字段统一使用：
  - `created_at`
  - `updated_at`

### 2.2 归属关系

- 除少量纯过程引用字段外，核心业务表都带 `book_id`
- 所有实体都归属于某一本书

### 2.3 JSON 字段策略

为兼容 SQLite 和后续 MySQL，V1 建议 JSON 类字段统一存为 `TEXT`，由业务层序列化/反序列化。

常见 JSON 字段包括：

- 字符串数组
- 数字数组
- 对象数组
- 结构化召回结果

### 2.4 关键词字段

以下表建议带 `keywords`：

- `world_settings`
- `characters`
- `factions`
- `relations`
- `items`
- `story_hooks`

约束：

- `keywords` 存储为 JSON 字符串数组
- 每个词建议不超过 8 个汉字
- 建议入库前去重

### 2.5 补充信息字段

以下表建议带 `append_notes`：

- `world_settings`
- `characters`
- `factions`
- `relations`
- `items`
- `story_hooks`

用途：

- 追加最近发生但不适合覆盖主字段的信息
- 便于 `approve` 后增量回写

## 3. 表关系总览

```text
books
  ├── outlines
  ├── world_settings
  ├── characters
  ├── factions
  ├── relations
  ├── items
  ├── story_hooks
  └── chapters
       ├── chapter_plans
       ├── chapter_drafts
       └── chapter_reviews
```

补充关系：

- `characters.item_ids` 关联 `items.id`
- `factions.item_ids` 关联 `items.id`
- `relations` 同时支持：
  - `character -> character`
  - `faction -> faction`
  - `character -> faction`
- `chapters.current_plan_id` 指向 `chapter_plans.id`
- `chapters.current_draft_id` 指向 `chapter_drafts.id`
- `chapters.current_review_id` 指向 `chapter_reviews.id`

## 4. 表设计

## 4.1 `books`

用途：一本书的顶层容器。

| 字段                      | 类型       | 必填 | 说明                                             |
| ----------------------- | -------- | -- | ---------------------------------------------- |
| `id`                    | INTEGER  | 是  | 主键                                             |
| `title`                 | TEXT     | 是  | 书名                                             |
| `summary`               | TEXT     | 否  | 本书简介                                           |
| `target_chapter_count`  | INTEGER  | 否  | 预期章节数                                          |
| `current_chapter_count` | INTEGER  | 是  | 当前已批准章节数，默认 0                                  |
| `status`                | TEXT     | 是  | `planning \| writing \| completed \| archived` |
| `metadata`              | TEXT     | 否  | 扩展 JSON                                        |
| `created_at`            | DATETIME | 是  | 创建时间                                           |
| `updated_at`            | DATETIME | 是  | 更新时间                                           |

建议索引：

- `idx_books_status(status)`

## 4.2 `outlines`

用途：分卷、章节弧线、大纲片段。

| 字段                 | 类型       | 必填 | 说明                      |
| ------------------ | -------- | -- | ----------------------- |
| `id`               | INTEGER  | 是  | 主键                      |
| `book_id`          | INTEGER  | 是  | 归属书籍                    |
| `volume_no`        | INTEGER  | 否  | 分卷编号                    |
| `volume_title`     | TEXT     | 否  | 分卷标题                    |
| `chapter_start_no` | INTEGER  | 否  | 适用起始章节                  |
| `chapter_end_no`   | INTEGER  | 否  | 适用结束章节                  |
| `outline_level`    | TEXT     | 是  | `volume \| chapter_arc` |
| `title`            | TEXT     | 是  | 大纲标题                    |
| `story_core`       | TEXT     | 否  | 故事核心剧情                  |
| `main_plot`        | TEXT     | 否  | 主线                      |
| `sub_plot`         | TEXT     | 否  | 支线                      |
| `foreshadowing`    | TEXT     | 否  | 伏笔                      |
| `expected_payoff`  | TEXT     | 否  | 预期回收点                   |
| `notes`            | TEXT     | 否  | 备注                      |
| `created_at`       | DATETIME | 是  | 创建时间                    |
| `updated_at`       | DATETIME | 是  | 更新时间                    |

建议索引：

- `idx_outlines_book_id(book_id)`
- `idx_outlines_book_range(book_id, chapter_start_no, chapter_end_no)`

## 4.3 `world_settings`

用途：世界规则、体系、国家、地理、历史等设定。

| 字段             | 类型       | 必填 | 说明                                                                                                                          |
| -------------- | -------- | -- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`           | INTEGER  | 是  | 主键                                                                                                                          |
| `book_id`      | INTEGER  | 是  | 归属书籍                                                                                                                        |
| `title`        | TEXT     | 是  | 设定标题                                                                                                                        |
| `category`     | TEXT     | 是  | `world_rule \| profession_system \| currency_system \| power_system \| geography \| nation \| religion \| history \| other` |
| `content`      | TEXT     | 是  | 设定正文                                                                                                                        |
| `status`       | TEXT     | 是  | `active \| deprecated`                                                                                                      |
| `append_notes` | TEXT     | 否  | 增量补充                                                                                                                        |
| `keywords`     | TEXT     | 否  | JSON 字符串数组                                                                                                                  |
| `created_at`   | DATETIME | 是  | 创建时间                                                                                                                        |
| `updated_at`   | DATETIME | 是  | 更新时间                                                                                                                        |

建议索引：

- `idx_world_settings_book_id(book_id)`
- `idx_world_settings_book_category(book_id, category)`
- `idx_world_settings_book_status(book_id, status)`

## 4.4 `characters`

用途：人物主档案。

| 字段                 | 类型       | 必填 | 说明                                                         |
| ------------------ | -------- | -- | ---------------------------------------------------------- |
| `id`               | INTEGER  | 是  | 主键                                                         |
| `book_id`          | INTEGER  | 是  | 归属书籍                                                       |
| `name`             | TEXT     | 是  | 人物名称                                                       |
| `alias`            | TEXT     | 否  | 别名                                                         |
| `gender`           | TEXT     | 否  | 性别                                                         |
| `age`              | INTEGER  | 否  | 年龄                                                         |
| `personality`      | TEXT     | 否  | 性格                                                         |
| `background`       | TEXT     | 否  | 背景                                                         |
| `current_location` | TEXT     | 否  | 当前所在地                                                      |
| `status`           | TEXT     | 是  | `alive \| missing \| dead \| sealed \| retired \| unknown` |
| `professions`      | TEXT     | 否  | JSON 字符串数组                                                 |
| `levels`           | TEXT     | 否  | JSON 字符串数组                                                 |
| `item_ids`         | TEXT     | 否  | JSON 数字数组                                                  |
| `currencies`       | TEXT     | 否  | JSON 对象数组                                                  |
| `abilities`        | TEXT     | 否  | JSON 字符串数组                                                 |
| `goal`             | TEXT     | 否  | 当前目标                                                       |
| `append_notes`     | TEXT     | 否  | 增量补充                                                       |
| `keywords`         | TEXT     | 否  | JSON 字符串数组                                                 |
| `created_at`       | DATETIME | 是  | 创建时间                                                       |
| `updated_at`       | DATETIME | 是  | 更新时间                                                       |

`currencies` 示例：

```json
[
  { "type": "金币", "amount": 120 },
  { "type": "灵石", "amount": 30 }
]
```

建议索引：

- `idx_characters_book_id(book_id)`
- `idx_characters_book_name(book_id, name)`
- `idx_characters_book_status(book_id, status)`

## 4.5 `factions`

用途：国家、宗门、商会、组织、家族等势力。

| 字段                    | 类型       | 必填 | 说明         |
| --------------------- | -------- | -- | ---------- |
| `id`                  | INTEGER  | 是  | 主键         |
| `book_id`             | INTEGER  | 是  | 归属书籍       |
| `name`                | TEXT     | 是  | 势力名        |
| `category`            | TEXT     | 否  | 势力类型       |
| `core_goal`           | TEXT     | 否  | 核心目标       |
| `description`         | TEXT     | 否  | 描述         |
| `leader_character_id` | INTEGER  | 否  | 首领人物 ID    |
| `headquarter`         | TEXT     | 否  | 总部/驻地      |
| `status`              | TEXT     | 否  | 状态         |
| `item_ids`            | TEXT     | 否  | JSON 数字数组  |
| `append_notes`        | TEXT     | 否  | 增量补充       |
| `keywords`            | TEXT     | 否  | JSON 字符串数组 |
| `created_at`          | DATETIME | 是  | 创建时间       |
| `updated_at`          | DATETIME | 是  | 更新时间       |

建议索引：

- `idx_factions_book_id(book_id)`
- `idx_factions_book_name(book_id, name)`
- `idx_factions_book_status(book_id, status)`

## 4.6 `relations`

用途：统一表示人物与人物、势力与势力、人物与势力之间的关系。

| 字段              | 类型       | 必填 | 说明                                 |
| --------------- | -------- | -- | ---------------------------------- |
| `id`            | INTEGER  | 是  | 主键                                 |
| `book_id`       | INTEGER  | 是  | 归属书籍                               |
| `source_type`   | TEXT     | 是  | `character \| faction`             |
| `source_id`     | INTEGER  | 是  | 发起方 ID                             |
| `target_type`   | TEXT     | 是  | `character \| faction`             |
| `target_id`     | INTEGER  | 是  | 目标方 ID                             |
| `relation_type` | TEXT     | 是  | 如 `friend`、`enemy`、`ally`、`member` |
| `intensity`     | INTEGER  | 否  | 关系强度，建议 `-100 ~ 100`               |
| `status`        | TEXT     | 否  | 当前关系状态                             |
| `description`   | TEXT     | 否  | 描述                                 |
| `append_notes`  | TEXT     | 否  | 增量补充                               |
| `keywords`      | TEXT     | 否  | JSON 字符串数组                         |
| `created_at`    | DATETIME | 是  | 创建时间                               |
| `updated_at`    | DATETIME | 是  | 更新时间                               |

建议索引：

- `idx_relations_book_id(book_id)`
- `idx_relations_book_source(book_id, source_type, source_id)`
- `idx_relations_book_target(book_id, target_type, target_id)`

## 4.7 `items`

用途：重要物品、法宝、信物、材料等。

| 字段             | 类型       | 必填 | 说明                             |
| -------------- | -------- | -- | ------------------------------ |
| `id`           | INTEGER  | 是  | 主键                             |
| `book_id`      | INTEGER  | 是  | 归属书籍                           |
| `name`         | TEXT     | 是  | 物品名                            |
| `category`     | TEXT     | 否  | 类别                             |
| `description`  | TEXT     | 否  | 描述                             |
| `owner_type`   | TEXT     | 是  | `character \| faction \| none` |
| `owner_id`     | INTEGER  | 否  | 当前拥有者 ID                       |
| `rarity`       | TEXT     | 否  | 稀有度                            |
| `status`       | TEXT     | 否  | 当前状态                           |
| `append_notes` | TEXT     | 否  | 增量补充                           |
| `keywords`     | TEXT     | 否  | JSON 字符串数组                     |
| `created_at`   | DATETIME | 是  | 创建时间                           |
| `updated_at`   | DATETIME | 是  | 更新时间                           |

建议索引：

- `idx_items_book_id(book_id)`
- `idx_items_book_owner(book_id, owner_type, owner_id)`
- `idx_items_book_name(book_id, name)`

## 4.8 `story_hooks`

用途：记录伏笔、悬念、谜团、待回收线索。

| 字段                  | 类型       | 必填 | 说明                                             |
| ------------------- | -------- | -- | ---------------------------------------------- |
| `id`                | INTEGER  | 是  | 主键                                             |
| `book_id`           | INTEGER  | 是  | 归属书籍                                           |
| `title`             | TEXT     | 是  | 钩子标题                                           |
| `hook_type`         | TEXT     | 否  | 如 `伏笔`、`悬念`、`任务`、`谜团`                          |
| `description`       | TEXT     | 否  | 描述                                             |
| `source_chapter_no` | INTEGER  | 否  | 来源章节                                           |
| `target_chapter_no` | INTEGER  | 否  | 预期回收章节                                         |
| `status`            | TEXT     | 是  | `open \| progressing \| resolved \| abandoned` |
| `importance`        | TEXT     | 否  | `low \| medium \| high \| critical`            |
| `append_notes`      | TEXT     | 否  | 增量补充                                           |
| `keywords`          | TEXT     | 否  | JSON 字符串数组                                     |
| `created_at`        | DATETIME | 是  | 创建时间                                           |
| `updated_at`        | DATETIME | 是  | 更新时间                                           |

建议索引：

- `idx_story_hooks_book_id(book_id)`
- `idx_story_hooks_book_status(book_id, status)`
- `idx_story_hooks_book_source(book_id, source_chapter_no)`

## 4.9 `chapters`

用途：章节主表，保存当前有效版本引用和正式稿。

| 字段                     | 类型       | 必填 | 说明                                                               |
| ---------------------- | -------- | -- | ---------------------------------------------------------------- |
| `id`                   | INTEGER  | 是  | 主键                                                               |
| `book_id`              | INTEGER  | 是  | 归属书籍                                                             |
| `chapter_no`           | INTEGER  | 是  | 章节号                                                              |
| `title`                | TEXT     | 否  | 章节标题                                                             |
| `summary`              | TEXT     | 否  | 章节摘要                                                             |
| `word_count`           | INTEGER  | 否  | 当前正式稿或当前主稿字数                                                     |
| `status`               | TEXT     | 是  | `todo \| planned \| drafted \| reviewed \| repaired \| approved` |
| `current_plan_id`      | INTEGER  | 否  | 当前计划版本 ID                                                        |
| `current_draft_id`     | INTEGER  | 否  | 当前草稿版本 ID                                                        |
| `current_review_id`    | INTEGER  | 否  | 当前审阅版本 ID                                                        |
| `final_content`        | TEXT     | 否  | 正式稿                                                              |
| `actual_character_ids` | TEXT     | 否  | JSON 数字数组                                                        |
| `actual_faction_ids`   | TEXT     | 否  | JSON 数字数组                                                        |
| `actual_item_ids`      | TEXT     | 否  | JSON 数字数组                                                        |
| `actual_hook_ids`      | TEXT     | 否  | JSON 数字数组                                                        |
| `created_at`           | DATETIME | 是  | 创建时间                                                             |
| `updated_at`           | DATETIME | 是  | 更新时间                                                             |

约束建议：

- `(book_id, chapter_no)` 唯一

建议索引：

- `uniq_chapters_book_chapter_no(book_id, chapter_no)`
- `idx_chapters_book_status(book_id, status)`

## 4.10 `chapter_plans`

用途：章节规划版本表。每次 `plan` 或手工导入 `plan` 都应新增一条。

| 字段                   | 类型       | 必填 | 说明                                   |
| -------------------- | -------- | -- | ------------------------------------ |
| `id`                 | INTEGER  | 是  | 主键                                   |
| `book_id`            | INTEGER  | 是  | 归属书籍                                 |
| `chapter_id`         | INTEGER  | 是  | 对应 `chapters.id`                     |
| `chapter_no`         | INTEGER  | 是  | 冗余章节号，便于查询                           |
| `version_no`         | INTEGER  | 是  | 版本号，自增                               |
| `status`             | TEXT     | 是  | `active \| archived`                 |
| `author_intent`      | TEXT     | 否  | 作者意图                                 |
| `intent_source`      | TEXT     | 是  | `user_input \| ai_generated`         |
| `intent_keywords`    | TEXT     | 否  | JSON 字符串数组                           |
| `manual_entity_refs` | TEXT     | 否  | JSON 对象，记录手工指定实体 ID                  |
| `retrieved_context`  | TEXT     | 否  | JSON 对象，记录召回内容与原因                    |
| `content`            | TEXT     | 是  | 规划正文                                 |
| `model`              | TEXT     | 否  | 模型名                                  |
| `provider`           | TEXT     | 否  | LLM 提供方                              |
| `source_type`        | TEXT     | 是  | `ai_generated \| imported \| manual` |
| `created_at`         | DATETIME | 是  | 创建时间                                 |
| `updated_at`         | DATETIME | 是  | 更新时间                                 |

`manual_entity_refs` 示例：

```json
{
  "characterIds": [12, 18],
  "factionIds": [7],
  "itemIds": [4],
  "hookIds": [8],
  "worldIds": [5],
  "relationIds": [9]
}
```

`retrieved_context` 示例：

```json
{
  "characters": [
    { "id": 12, "name": "林夜", "reason": "manual_id", "content": "主角，当前练气三层，持有黑铁令。" }
  ],
  "hooks": [
    { "id": 8, "title": "黑铁令来历", "reason": "keyword_hit", "content": "与内门长老相关的未解谜团。" }
  ]
}
```

建议索引：

- `idx_chapter_plans_book_chapter_id(book_id, chapter_id)`
- `idx_chapter_plans_book_chapter(book_id, chapter_no)`
- `idx_chapter_plans_book_status(book_id, status)`

## 4.11 `chapter_drafts`

用途：章节草稿版本表。每次 `draft`、`repair`、手工导入草稿都新增一条。

| 字段                 | 类型       | 必填 | 说明                                               |
| ------------------ | -------- | -- | ------------------------------------------------ |
| `id`               | INTEGER  | 是  | 主键                                               |
| `book_id`          | INTEGER  | 是  | 归属书籍                                             |
| `chapter_id`       | INTEGER  | 是  | 对应 `chapters.id`                                 |
| `chapter_no`       | INTEGER  | 是  | 冗余章节号                                            |
| `version_no`       | INTEGER  | 是  | 版本号，自增                                           |
| `based_on_plan_id` | INTEGER  | 否  | 关联 `chapter_plans.id`                            |
| `status`           | TEXT     | 是  | `active \| archived`                             |
| `content`          | TEXT     | 是  | 草稿正文                                             |
| `summary`          | TEXT     | 否  | 草稿摘要                                             |
| `word_count`       | INTEGER  | 否  | 草稿字数                                             |
| `model`            | TEXT     | 否  | 模型名                                              |
| `provider`         | TEXT     | 否  | LLM 提供方                                          |
| `source_type`      | TEXT     | 是  | `ai_generated \| repaired \| imported \| manual` |
| `created_at`       | DATETIME | 是  | 创建时间                                             |
| `updated_at`       | DATETIME | 是  | 更新时间                                             |

建议索引：

- `idx_chapter_drafts_book_chapter_id(book_id, chapter_id)`
- `idx_chapter_drafts_book_plan_id(book_id, based_on_plan_id)`
- `idx_chapter_drafts_book_status(book_id, status)`

## 4.12 `chapter_reviews`

用途：章节审阅版本表。每次 `review` 都新增一条。

| 字段                   | 类型       | 必填 | 说明                                   |
| -------------------- | -------- | -- | ------------------------------------ |
| `id`                 | INTEGER  | 是  | 主键                                   |
| `book_id`            | INTEGER  | 是  | 归属书籍                                 |
| `chapter_id`         | INTEGER  | 是  | 对应 `chapters.id`                     |
| `chapter_no`         | INTEGER  | 是  | 冗余章节号                                |
| `draft_id`           | INTEGER  | 是  | 对应 `chapter_drafts.id`               |
| `version_no`         | INTEGER  | 是  | 版本号，自增                               |
| `status`             | TEXT     | 是  | `active \| archived`                 |
| `summary`            | TEXT     | 否  | 审阅摘要                                 |
| `issues`             | TEXT     | 否  | JSON 数组                              |
| `risks`              | TEXT     | 否  | JSON 数组                              |
| `continuity_checks`  | TEXT     | 否  | JSON 数组                              |
| `repair_suggestions` | TEXT     | 否  | JSON 数组                              |
| `raw_result`         | TEXT     | 是  | 审阅完整结果                               |
| `model`              | TEXT     | 否  | 模型名                                  |
| `provider`           | TEXT     | 否  | LLM 提供方                              |
| `source_type`        | TEXT     | 是  | `ai_generated \| imported \| manual` |
| `created_at`         | DATETIME | 是  | 创建时间                                 |
| `updated_at`         | DATETIME | 是  | 更新时间                                 |

建议索引：

- `idx_chapter_reviews_book_chapter_id(book_id, chapter_id)`
- `idx_chapter_reviews_book_draft_id(book_id, draft_id)`
- `idx_chapter_reviews_book_status(book_id, status)`

## 5. 建表顺序

1. `books`
2. `outlines`
3. `world_settings`
4. `items`
5. `characters`
6. `factions`
7. `relations`
8. `story_hooks`
9. `chapters`
10. `chapter_plans`
11. `chapter_drafts`
12. `chapter_reviews`

## 6. V1 设计结论

V1 最关键的结构选择是：

- 设定类数据集中在业务实体表中
- 章节流程数据拆成独立版本表
- `chapters` 只承担“当前章节状态 + 当前版本引用 + 正式稿”职责

这样后续扩展：

- Markdown 导入导出
- 版本回滚
- AI 多次重跑
- 草稿修复历史
- 审阅历史追踪

都会更顺。
