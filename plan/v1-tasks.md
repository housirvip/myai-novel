# AI 小说工具 V1 Checklist

## 1. 说明

本文档是 [v1.md](/Users/housirvip/codex/myai-novel/plan/v1.md) 和 [data-tables-v1.md](/Users/housirvip/codex/myai-novel/plan/data-tables-v1.md) 的执行清单版本。

使用方式：

- 未完成任务用 `- [ ]`
- 已完成任务改成 `- [x]`
- 如果某个大任务拆成更多子项，优先勾选子项，再勾选父任务

## 2. 阶段清单

## 2.1 阶段一：工程初始化

- [ ] `T001` 初始化 Node.js + TypeScript 工程
  - [ ] 创建 `package.json`
  - [ ] 创建 `tsconfig.json`
  - [ ] 创建基础目录结构 `src/cli` `src/config` `src/core` `src/domain` `src/shared`
  - [ ] 配置 `build` `dev` `lint` `test` 脚本
  - [ ] 验证 `npm run build` 可通过

- [ ] `T002` 初始化 CLI 入口
  - [ ] 创建 `src/cli/index.ts`
  - [ ] 接入 `commander`
  - [ ] 定义 `novel` 根命令
  - [ ] 支持 `--help`
  - [ ] 支持 `--version`
  - [ ] 验证 `novel --help` 正常输出

## 2.2 阶段二：配置与日志系统

- [ ] `T003` 实现环境变量配置模块
  - [ ] 接入 `dotenv`
  - [ ] 创建 `src/config/env.ts`
  - [ ] 用 `zod` 校验配置
  - [ ] 支持 DB 配置
  - [ ] 支持 LLM provider 配置
  - [ ] 支持日志配置
  - [ ] 生成 `.env.example`

- [ ] `T004` 实现日志模块
  - [ ] 创建 `src/core/logger/index.ts`
  - [ ] 创建 `src/core/logger/context.ts`
  - [ ] 创建 `src/core/logger/serializers.ts`
  - [ ] 接入 `pino`
  - [ ] 支持 `traceId`
  - [ ] 支持 `runId`
  - [ ] 支持 `pretty/json`
  - [ ] 支持 AI 输入输出日志开关

- [ ] `T005` 实现计时与日志包装工具
  - [ ] 封装 `withTimingLog`
  - [ ] 支持成功自动写日志
  - [ ] 支持失败自动写日志
  - [ ] 支持 `durationMs`
  - [ ] 支持错误摘要与脱敏

## 2.3 阶段三：数据库与迁移

- [ ] `T006` 接入 SQLite 和 Kysely
  - [ ] 创建 `src/core/db/client.ts`
  - [ ] 创建 `src/core/db/dialects/sqlite.ts`
  - [ ] 预留 `src/core/db/dialects/mysql.ts`
  - [ ] 接入 `better-sqlite3`
  - [ ] 接入 `kysely`
  - [ ] 验证本地可连接 SQLite

- [ ] `T007` 定义 Database 类型
  - [ ] 定义 `books`
  - [ ] 定义 `outlines`
  - [ ] 定义 `world_settings`
  - [ ] 定义 `characters`
  - [ ] 定义 `factions`
  - [ ] 定义 `relations`
  - [ ] 定义 `items`
  - [ ] 定义 `story_hooks`
  - [ ] 定义 `chapters`
  - [ ] 定义 `chapter_plans`
  - [ ] 定义 `chapter_drafts`
  - [ ] 定义 `chapter_reviews`
  - [ ] 定义 `chapter_finals`

- [ ] `T008` 编写初始 migration
  - [ ] 创建所有表
  - [ ] 创建唯一约束
  - [ ] 创建索引
  - [ ] 校验所有带 `book_id` 的核心索引都带上 `book_id`
  - [ ] 校验表结构与文档一致

- [ ] `T009` 实现数据库初始化命令
  - [ ] 增加 `novel db:init`
  - [ ] 增加 `novel db:migrate`
  - [ ] 增加数据库连接检查命令

## 2.4 阶段四：Repository 与 CRUD 服务

- [ ] `T010` 实现核心 Repository
  - [ ] `BookRepository`
  - [ ] `OutlineRepository`
  - [ ] `WorldSettingRepository`
  - [ ] `CharacterRepository`
  - [ ] `FactionRepository`
  - [ ] `RelationRepository`
  - [ ] `ItemRepository`
  - [ ] `StoryHookRepository`
  - [ ] `ChapterRepository`
  - [ ] `ChapterPlanRepository`
  - [ ] `ChapterDraftRepository`
  - [ ] `ChapterReviewRepository`
  - [ ] `ChapterFinalRepository`
  - [ ] CRUD 操作日志已接入

- [ ] `T011` 实现 CRUD Service
  - [ ] `BookService`
  - [ ] `OutlineService`
  - [ ] `WorldSettingService`
  - [ ] `CharacterService`
  - [ ] `FactionService`
  - [ ] `RelationService`
  - [ ] `ItemService`
  - [ ] `StoryHookService`
  - [ ] `ChapterService`
  - [ ] 参数校验已接入

- [ ] `T012` 实现资源 CRUD CLI 命令
  - [ ] `book`
  - [ ] `outline`
  - [ ] `world`
  - [ ] `character`
  - [ ] `faction`
  - [ ] `relation`
  - [ ] `item`
  - [ ] `hook`
  - [ ] `chapter`
  - [ ] 每个命令支持 `create`
  - [ ] 每个命令支持 `list`
  - [ ] 每个命令支持 `get`
  - [ ] 每个命令支持 `update`
  - [ ] 每个命令支持 `delete`

## 2.5 阶段五：LLM 抽象与 Provider

- [ ] `T013` 定义 LLM 核心接口与工厂
  - [ ] 创建 `src/core/llm/types.ts`
  - [ ] 创建 `src/core/llm/factory.ts`
  - [ ] 定义 `LlmClient`
  - [ ] 定义 `LlmGenerateParams`
  - [ ] 定义 `LlmGenerateResult`

- [ ] `T014` 实现 `mock` provider
  - [ ] 支持固定输出
  - [ ] 支持 fixture 输出
  - [ ] 支持结构化 JSON 输出
  - [ ] 验证无 API Key 也能跑通

- [ ] `T015` 实现真实 provider
  - [ ] `openai`
  - [ ] `anthropic`
  - [ ] `custom`
  - [ ] 统一错误处理
  - [ ] 统一 usage 记录
  - [ ] 统一耗时日志

## 2.6 阶段六：检索与 Prompt 组织

- [ ] `T016` 实现关键词与输入解析工具
  - [ ] 解析 `authorIntent`
  - [ ] 解析手工指定实体 ID
  - [ ] 校验关键词长度
  - [ ] 校验 JSON 输入

- [ ] `T017` 实现检索 Query Service
  - [ ] 检索大纲
  - [ ] 检索上文章节
  - [ ] 检索故事钩子
  - [ ] 检索人物
  - [ ] 检索势力
  - [ ] 检索物品
  - [ ] 检索关系
  - [ ] 检索世界设定
  - [ ] 支持手工指定 ID
  - [ ] 支持关键词命中
  - [ ] 支持状态过滤
  - [ ] 支持近期章节加权

- [ ] `T018` 实现 Prompt 模板层
  - [ ] `buildPlanPrompt`
  - [ ] `buildDraftPrompt`
  - [ ] `buildReviewPrompt`
  - [ ] `buildRepairPrompt`
  - [ ] `buildApprovePrompt`
  - [ ] AI 关键词提取 Prompt
  - [ ] AI 作者意图生成 Prompt

## 2.7 阶段七：章节工作流

- [ ] `T019` 实现 `plan` 工作流
  - [ ] 读取章节输入参数
  - [ ] 支持 `authorIntent`
  - [ ] 支持手工指定实体 ID
  - [ ] 无作者意图时先生成作者意图草案
  - [ ] AI 提取关键词
  - [ ] 生成 `retrieved_context`
  - [ ] 写入 `chapter_plans`
  - [ ] 更新 `chapters.current_plan_id`
  - [ ] 更新章节状态为 `planned`

- [ ] `T020` 实现 `draft` 工作流
  - [ ] 读取当前 `chapter_plans`
  - [ ] 组织上下文
  - [ ] 生成草稿
  - [ ] 写入 `chapter_drafts`
  - [ ] 更新 `chapters.current_draft_id`
  - [ ] 更新章节状态为 `drafted`

- [ ] `T021` 实现 `review` 工作流
  - [ ] 读取当前 `chapter_drafts`
  - [ ] 读取当前 `chapter_plans`
  - [ ] 组织审阅 Prompt
  - [ ] 写入 `chapter_reviews`
  - [ ] 更新 `chapters.current_review_id`
  - [ ] 更新章节状态为 `reviewed`

- [ ] `T022` 实现 `repair` 工作流
  - [ ] 读取当前 `chapter_drafts`
  - [ ] 读取当前 `chapter_reviews`
  - [ ] 生成新草稿版本
  - [ ] 写入 `based_on_plan_id`
  - [ ] 写入 `based_on_draft_id`
  - [ ] 写入 `based_on_review_id`
  - [ ] 更新 `chapters.current_draft_id`
  - [ ] 更新章节状态为 `repaired`

- [ ] `T023` 实现 `approve` 工作流
  - [ ] 读取当前 draft / plan / review
  - [ ] 写入 `chapter_finals`
  - [ ] 更新 `chapters.current_final_id`
  - [ ] 提取事实 diff
  - [ ] 更新人物
  - [ ] 更新势力
  - [ ] 更新物品
  - [ ] 更新钩子
  - [ ] 更新关系
  - [ ] 更新世界设定
  - [ ] 更新 `actual_character_ids`
  - [ ] 更新 `actual_faction_ids`
  - [ ] 更新 `actual_item_ids`
  - [ ] 更新 `actual_hook_ids`
  - [ ] 更新 `actual_world_setting_ids`
  - [ ] 更新 `books.current_chapter_count`
  - [ ] 更新章节状态为 `approved`

- [ ] `T024` 实现章节 Markdown 导入导出
  - [ ] `chapter export --stage plan`
  - [ ] `chapter export --stage draft`
  - [ ] `chapter export --stage final`
  - [ ] `chapter import --stage plan`
  - [ ] `chapter import --stage draft`
  - [ ] `chapter import --stage final`
  - [ ] 导入时创建新版本，不覆盖旧版本

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

- [ ] 第一轮基础设施：`T001-T009`
- [ ] 第二轮资源层：`T010-T012`
- [ ] 第三轮模型层：`T013-T015`
- [ ] 第四轮检索与 Prompt：`T016-T018`
- [ ] 第五轮章节工作流：`T019-T024`
- [ ] 第六轮测试与文档：`T025-T027`

## 4. 第一批建议先做

- [ ] `T001` 初始化工程
- [ ] `T002` 初始化 CLI
- [ ] `T003` 配置模块
- [ ] `T004` 日志模块
- [ ] `T006` SQLite + Kysely
- [ ] `T007` Database 类型
- [ ] `T008` migration
- [ ] `T009` db:init / db:migrate
- [ ] `T010` repository
- [ ] `T014` mock provider
- [ ] `T019` plan
- [ ] `T020` draft

## 5. V1 完成定义

- [ ] 所有核心表与 migration 已完成
- [ ] 所有资源 CRUD CLI 可用
- [ ] `mock` 模式下 `plan -> draft -> review -> repair -> approve` 可跑通
- [ ] 支持 Markdown 导入导出 `plan/draft/final`
- [ ] 支持日志、耗时记录、AI 内容日志开关
- [ ] 支持 `approve` 后的事实回写
