# AI 小说工具 V1 Checklist

## 1. 说明

本文档是 [v1.md](/Users/housirvip/codex/myai-novel/plan/v1.md) 和 [data-tables-v1.md](/Users/housirvip/codex/myai-novel/plan/data-tables-v1.md) 的执行清单版本。

使用方式：

- 未完成任务用 `- [ ]`
- 已完成任务改成 `- [x]`
- 如果某个大任务拆成更多子项，优先勾选子项，再勾选父任务

## 2. 阶段清单

## 2.1 阶段一：工程初始化

- [x] `T001` 初始化 Node.js + TypeScript 工程
  - [x] 创建 `package.json`
  - [x] 创建 `tsconfig.json`
  - [x] 创建基础目录结构 `src/cli` `src/config` `src/core` `src/domain` `src/shared`
  - [x] 配置 `build` `dev` `lint` `test` 脚本
  - [x] 验证 `npm run build` 可通过

- [x] `T002` 初始化 CLI 入口
  - [x] 创建 `src/cli/index.ts`
  - [x] 接入 `commander`
  - [x] 定义 `novel` 根命令
  - [x] 支持 `--help`
  - [x] 支持 `--version`
  - [x] 验证 `novel --help` 正常输出

## 2.2 阶段二：配置与日志系统

- [x] `T003` 实现环境变量配置模块
  - [x] 接入 `dotenv`
  - [x] 创建 `src/config/env.ts`
  - [x] 用 `zod` 校验配置
  - [x] 支持 DB 配置
  - [x] 支持 LLM provider 配置
  - [x] 支持日志配置
  - [x] 生成 `.env.example`

- [x] `T004` 实现日志模块
  - [x] 创建 `src/core/logger/index.ts`
  - [x] 创建 `src/core/logger/context.ts`
  - [x] 创建 `src/core/logger/serializers.ts`
  - [x] 接入 `pino`
  - [x] 支持 `traceId`
  - [x] 支持 `runId`
  - [x] 支持 `pretty/json`
  - [x] 支持 AI 输入输出日志开关

- [x] `T005` 实现计时与日志包装工具
  - [x] 封装 `withTimingLog`
  - [x] 支持成功自动写日志
  - [x] 支持失败自动写日志
  - [x] 支持 `durationMs`
  - [x] 支持错误摘要与脱敏

## 2.3 阶段三：数据库与迁移

- [x] `T006` 接入 SQLite 和 Kysely
  - [x] 创建 `src/core/db/client.ts`
  - [x] 创建 `src/core/db/dialects/sqlite.ts`
  - [x] 预留 `src/core/db/dialects/mysql.ts`
  - [x] 接入 `better-sqlite3`
  - [x] 接入 `kysely`
  - [x] 验证本地可连接 SQLite

- [x] `T007` 定义 Database 类型
  - [x] 定义 `books`
  - [x] 定义 `outlines`
  - [x] 定义 `world_settings`
  - [x] 定义 `characters`
  - [x] 定义 `factions`
  - [x] 定义 `relations`
  - [x] 定义 `items`
  - [x] 定义 `story_hooks`
  - [x] 定义 `chapters`
  - [x] 定义 `chapter_plans`
  - [x] 定义 `chapter_drafts`
  - [x] 定义 `chapter_reviews`
  - [x] 定义 `chapter_finals`

- [x] `T008` 编写初始 migration
  - [x] 创建所有表
  - [x] 创建唯一约束
  - [x] 创建索引
  - [x] 校验所有带 `book_id` 的核心索引都带上 `book_id`
  - [x] 校验表结构与文档一致

- [x] `T009` 实现数据库初始化命令
  - [x] 增加 `novel db:init`
  - [x] 增加 `novel db:migrate`
  - [x] 增加数据库连接检查命令

## 2.4 阶段四：Repository 与 CRUD 服务

- [x] `T010` 实现核心 Repository
  - [x] `BookRepository`
  - [x] `OutlineRepository`
  - [x] `WorldSettingRepository`
  - [x] `CharacterRepository`
  - [x] `FactionRepository`
  - [x] `RelationRepository`
  - [x] `ItemRepository`
  - [x] `StoryHookRepository`
  - [x] `ChapterRepository`
  - [x] `ChapterPlanRepository`
  - [x] `ChapterDraftRepository`
  - [x] `ChapterReviewRepository`
  - [x] `ChapterFinalRepository`
  - [x] CRUD 操作日志已接入

- [x] `T011` 实现 CRUD Service
  - [x] `BookService`
  - [x] `OutlineService`
  - [x] `WorldSettingService`
  - [x] `CharacterService`
  - [x] `FactionService`
  - [x] `RelationService`
  - [x] `ItemService`
  - [x] `StoryHookService`
  - [x] `ChapterService`
  - [x] 参数校验已接入

- [x] `T012` 实现资源 CRUD CLI 命令
  - [x] `book`
  - [x] `outline`
  - [x] `world`
  - [x] `character`
  - [x] `faction`
  - [x] `relation`
  - [x] `item`
  - [x] `hook`
  - [x] `chapter`
  - [x] 每个命令支持 `create`
  - [x] 每个命令支持 `list`
  - [x] 每个命令支持 `get`
  - [x] 每个命令支持 `update`
  - [x] 每个命令支持 `delete`

## 2.5 阶段五：LLM 抽象与 Provider

- [x] `T013` 定义 LLM 核心接口与工厂
  - [x] 创建 `src/core/llm/types.ts`
  - [x] 创建 `src/core/llm/factory.ts`
  - [x] 定义 `LlmClient`
  - [x] 定义 `LlmGenerateParams`
  - [x] 定义 `LlmGenerateResult`

- [x] `T014` 实现 `mock` provider
  - [x] 支持固定输出
  - [x] 支持 fixture 输出
  - [x] 支持结构化 JSON 输出
  - [x] 验证无 API Key 也能跑通

- [x] `T015` 实现真实 provider
  - [x] `openai`
  - [x] `anthropic`
  - [x] `custom`
  - [x] 统一错误处理
  - [x] 统一 usage 记录
  - [x] 统一耗时日志

## 2.6 阶段六：检索与 Prompt 组织

- [x] `T016` 实现关键词与输入解析工具
  - [x] 解析 `authorIntent`
  - [x] 解析手工指定实体 ID
  - [x] 校验关键词长度
  - [x] 校验 JSON 输入

- [x] `T017` 实现检索 Query Service
  - [x] 检索大纲
  - [x] 检索上文章节
  - [x] 检索故事钩子
  - [x] 检索人物
  - [x] 检索势力
  - [x] 检索物品
  - [x] 检索关系
  - [x] 检索世界设定
  - [x] 支持手工指定 ID
  - [x] 支持关键词命中
  - [x] 支持状态过滤
  - [x] 支持近期章节加权

- [x] `T018` 实现 Prompt 模板层
  - [x] `buildPlanPrompt`
  - [x] `buildDraftPrompt`
  - [x] `buildReviewPrompt`
  - [x] `buildRepairPrompt`
  - [x] `buildApprovePrompt`
  - [x] AI 关键词提取 Prompt
  - [x] AI 作者意图生成 Prompt

## 2.7 阶段七：章节工作流

- [x] `T019` 实现 `plan` 工作流
  - [x] 读取章节输入参数
  - [x] 支持 `authorIntent`
  - [x] 支持手工指定实体 ID
  - [x] 无作者意图时先生成作者意图草案
  - [x] AI 提取关键词
  - [x] 生成 `retrieved_context`
  - [x] 写入 `chapter_plans`
  - [x] 更新 `chapters.current_plan_id`
  - [x] 更新章节状态为 `planned`

- [x] `T020` 实现 `draft` 工作流
  - [x] 读取当前 `chapter_plans`
  - [x] 组织上下文
  - [x] 生成草稿
  - [x] 写入 `chapter_drafts`
  - [x] 更新 `chapters.current_draft_id`
  - [x] 更新章节状态为 `drafted`

- [x] `T021` 实现 `review` 工作流
  - [x] 读取当前 `chapter_drafts`
  - [x] 读取当前 `chapter_plans`
  - [x] 组织审阅 Prompt
  - [x] 写入 `chapter_reviews`
  - [x] 更新 `chapters.current_review_id`
  - [x] 更新章节状态为 `reviewed`

- [x] `T022` 实现 `repair` 工作流
  - [x] 读取当前 `chapter_drafts`
  - [x] 读取当前 `chapter_reviews`
  - [x] 生成新草稿版本
  - [x] 写入 `based_on_plan_id`
  - [x] 写入 `based_on_draft_id`
  - [x] 写入 `based_on_review_id`
  - [x] 更新 `chapters.current_draft_id`
  - [x] 更新章节状态为 `repaired`

- [ ] `T023` 实现 `approve` 工作流
  - [x] 读取当前 draft / plan / review
  - [x] 写入 `chapter_finals`
  - [x] 更新 `chapters.current_final_id`
  - [x] 提取事实 diff
  - [x] 更新人物
  - [x] 更新势力
  - [x] 更新物品
  - [x] 更新钩子
  - [ ] 更新关系
  - [x] 更新世界设定
  - [x] 更新 `actual_character_ids`
  - [x] 更新 `actual_faction_ids`
  - [x] 更新 `actual_item_ids`
  - [x] 更新 `actual_hook_ids`
  - [x] 更新 `actual_world_setting_ids`
  - [x] 更新 `books.current_chapter_count`
  - [x] 更新章节状态为 `approved`

- [x] `T024` 实现章节 Markdown 导入导出
  - [x] `chapter export --stage plan`
  - [x] `chapter export --stage draft`
  - [x] `chapter export --stage final`
  - [x] `chapter import --stage plan`
  - [x] `chapter import --stage draft`
  - [x] `chapter import --stage final`
  - [x] 导入时创建新版本，不覆盖旧版本

## 2.8 阶段八：测试、文档与示例数据

- [ ] `T025` 单元测试
  - [ ] 配置解析测试
  - [ ] logger 开关测试
  - [ ] 关键词校验测试
  - [ ] repository CRUD 测试
  - [ ] LLM factory 测试
  - [ ] diff 解析测试

- [ ] `T026` 集成测试
  - [ ] SQLite 临时库初始化
  - [ ] `plan` 全链路测试
  - [ ] `draft` 全链路测试
  - [ ] `review` 全链路测试
  - [ ] `repair` 全链路测试
  - [ ] `approve` 全链路测试
  - [ ] Markdown 导入导出测试

- [ ] `T027` README 与示例数据
  - [ ] 安装说明
  - [ ] `.env` 使用说明
  - [ ] CLI 示例
  - [ ] 最小示例书籍数据

## 3. 建议执行顺序

- [x] 第一轮基础设施：`T001-T009`
- [x] 第二轮资源层：`T010-T012`
- [x] 第三轮模型层：`T013-T015`
- [x] 第四轮检索与 Prompt：`T016-T018`
- [ ] 第五轮章节工作流：`T019-T024`
- [ ] 第六轮测试与文档：`T025-T027`

## 4. 第一批建议先做

- [x] `T001` 初始化工程
- [x] `T002` 初始化 CLI
- [x] `T003` 配置模块
- [x] `T004` 日志模块
- [x] `T006` SQLite + Kysely
- [x] `T007` Database 类型
- [x] `T008` migration
- [x] `T009` db:init / db:migrate
- [x] `T010` repository
- [x] `T014` mock provider
- [x] `T019` plan
- [x] `T020` draft
- [x] `T022` repair
- [ ] `T023` approve

## 5. V1 完成定义

- [x] 所有核心表与 migration 已完成
- [x] 所有资源 CRUD CLI 可用
- [x] `mock` 模式下 `plan -> draft -> review -> repair -> approve` 可跑通
- [x] 支持 Markdown 导入导出 `plan/draft/final`
- [x] 支持日志、耗时记录、AI 内容日志开关
- [ ] 支持 `approve` 后的事实回写
