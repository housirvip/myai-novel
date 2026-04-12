# AI 小说工具 V2 执行清单

> 对应总方案：[`v2.md`](./v2.md)

## 使用说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- 每一项尽量对应一个可提交、可验证的小阶段
- 推荐按 P0 -> P1 -> P2 -> P3 顺序推进

---

## P0. 召回结构升级与阶段化上下文

> 目标：先提升生成质量与上下文稳定性，不引入 MySQL 复杂度。

### P0-1. 冻结 V2 主线范围
- [ ] 确认 V2 主优先级为“召回升级 > MySQL 支持 > rerank 预留”
- [ ] 确认 V2 暂不纳入 Web UI、多用户、权限系统
- [x] 记录当前 SQLite 全链路回归命令

### P0-2. 设计新的 `retrievedContext` 结构
- [ ] 盘点当前 `PlanRetrievedContext` 的字段与使用位置
- [x] 设计新的分层结构：`hardConstraints` / `softReferences` / `riskReminders`
- [x] 明确哪些实体进入硬约束层
- [x] 明确哪些内容只作为软参考
- [x] 评估新结构对 `chapter_plans.retrieved_context` 的兼容策略

**验收**
- [x] 有明确的 TypeScript 类型定义草案
- [x] 有旧数据兼容策略说明

### P0-3. 调整召回输出构造逻辑
- [x] 修改 `src/domain/planning/retrieval-service.ts` 的输出结构
- [x] 保留 explainability 信息：`reason`、`score`
- [ ] 如有必要，补充 `matchedFields` / `matchedKeywords`
- [x] 确保 `riskReminders` 不与实体召回结果混淆

**验收**
- [x] 召回结果结构可被序列化并保存到 `chapter_plans`
- [x] 现有 `plan` 工作流可读取新结构

### P0-4. 新增阶段化上下文裁剪层
- [x] 新建 `src/domain/planning/context-views.ts`
- [x] 实现 `buildDraftContextView()`
- [x] 实现 `buildReviewContextView()`
- [x] 实现 `buildApproveDiffContextView()`
- [x] 明确每种视图保留哪些字段、丢弃哪些字段

**依赖**
- [x] 依赖 P0-2 / P0-3 完成

### P0-5. Prompt 与 Workflow 适配新上下文结构
- [x] 更新 `src/domain/planning/prompts.ts`
- [x] `buildPlanPrompt()` 支持新结构
- [x] `buildDraftPrompt()` 消费 draft 视图
- [x] `buildReviewPrompt()` 消费 review 视图
- [x] `buildRepairPrompt()` 评估是否需要单独 repair 视图
- [x] `buildApprovePrompt()` 与 approve diff prompt 消费裁剪后的上下文
- [x] 更新 `plan/draft/review/repair/approve` workflow 接入新结构

**依赖**
- [x] 依赖 P0-4 完成

### P0-6. SQLite 回归验证
- [x] 运行 `npm run check`
- [x] 运行 `npm run build`
- [x] 运行 `npm test`
- [x] 跑通最小 CLI 工作流

**完成定义**
- [x] `retrievedContext` 已完成分层
- [x] `draft / review / approve diff` 已使用阶段化上下文视图
- [x] 不重新做数据库召回
- [x] SQLite 默认行为无回退

---

## P1. 召回质量增强

> 目标：在结构稳定后，再提升召回质量与连续性约束能力。

### P1-1. 拆分打分逻辑
- [x] 从 `retrieval-service.ts` 中抽出独立 ranking/score 模块
- [x] 新建 `src/domain/planning/retrieval-ranking.ts`
- [ ] 先做到“结构拆分但默认行为不变”

### P1-2. 差异化权重
- [x] 人物：提高 `name` / `alias` 权重
- [x] 势力：区分 `name` / `category` / `core_goal` 权重
- [x] 物品：区分 `name` / `description` / `rarity` 权重
- [x] 关系：提高关系两端实体与 `relationType` 权重
- [x] 世界设定：提高 `title` / `category` 权重
- [x] 评估钩子邻近性权重是否继续沿用或细化

### P1-3. 高风险连续性实体优先
- [ ] 定义“高风险连续性实体”判定规则
- [x] 人物当前地点加入连续性优先判断
- [x] 关键物品持有状态加入连续性优先判断
- [x] 未回收重要钩子加入连续性优先判断
- [x] 世界规则加入连续性优先判断
- [x] 将这些内容显式提升到 `hardConstraints` 或高优先 `riskReminders`

### P1-4. 召回质量验证
- [x] 抽样比对 V1 与 V2 的召回结果差异
- [x] 检查高风险连续性项是否更稳定进入上下文
- [x] 检查 prompt 长度是否下降或更可控
- [x] 检查 `review` 与 `approve diff` 的上下文噪声是否下降

**依赖**
- [x] 依赖 P0 完成

**完成定义**
- [x] 强约束实体排序更靠前
- [x] 连续性高风险项可稳定进入上下文
- [x] 召回结果仍可解释

---

## P2. MySQL 支持落地

> 目标：让当前 SQLite 业务链路在 MySQL 下等价可运行，而不是引入 MySQL 专属能力。

### P2-1. MySQL 技术选型
- [x] 确认 Kysely MySQL 方案
- [x] 确认驱动库
- [x] 确认连接池关闭策略
- [x] 确认 migration 在 MySQL 下的运行方式

### P2-2. 环境变量与配置扩展
- [x] 更新 `.env.example`
- [x] 更新 `src/config/env.ts`
- [x] 增加 MySQL 连接项：`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`
- [x] 增加连接池配置：`DB_POOL_MIN`、`DB_POOL_MAX`
- [x] 明确 SQLite / MySQL 的默认行为

### P2-3. 实现 MySQL dialect
- [x] 完成 `src/core/db/dialects/mysql.ts`
- [x] 创建 Kysely MySQL dialect
- [x] 支持连接池释放
- [x] 保持与 `createSqliteDb()` 一致的接口形态

### P2-4. 扩展 DatabaseManager
- [x] 更新 `src/core/db/client.ts`
- [x] 根据 `env.DB_CLIENT` 路由到 sqlite / mysql
- [x] 保留 sqlite 作为默认本地方案
- [x] MySQL 下输出必要连接日志

### P2-5. Migration 兼容性检查
- [x] 检查所有 migration 是否依赖 SQLite 特性
- [x] 检查主键、自增、默认值、时间字段兼容性
- [x] 检查唯一约束与索引在 MySQL 下的可用性
- [x] 检查 JSON 文本字段策略是否仍然成立
- [x] 必要时修正 migration 写法

### P2-6. Repository / Workflow 方言兼容性核查
- [x] 检查 Repository 查询是否使用 SQLite 特有语法
- [x] 检查 transaction 语义是否在 MySQL 下保持一致
- [x] 检查版本号生成与 pointer 更新逻辑是否稳定
- [x] 检查 JSON 序列化/反序列化路径是否无方言耦合

### P2-7. MySQL 测试环境与验证
- [x] 准备本地或 CI MySQL 实例
- [x] 定义测试数据库初始化方式
- [x] 定义测试后清理方式
- [x] 增加 MySQL 配置解析测试
- [x] 增加 MySQL client 创建测试
- [x] 增加 MySQL migration 测试
- [x] 增加 MySQL 下 `plan -> draft -> review -> repair -> approve` 端到端测试
- [x] 增加 MySQL 下 `chapter export/import` 测试

**依赖**
- [ ] 建议依赖 P0 完成后再启动

**完成定义**
- [x] `DB_CLIENT=mysql` 可正常初始化、迁移、运行 workflow
- [~] SQLite 与 MySQL 下核心链路行为一致
- [x] 默认 SQLite 开发体验不变

---

## P3. 扩展预留与收尾

> 目标：为未来能力预留接口，并完成文档与维护性收口。

### P3-1. 为 rerank / embedding 预留接口
- [x] 设计 `RetrievalCandidateProvider`
- [x] 设计 `RetrievalReranker`
- [x] 明确默认实现仍为“规则召回 + 直接排序”
- [x] 定义 rerank 插口但默认不启用
- [x] 保持 embedding 仍为未来扩展项，不强行接入 V2 主链路
- [x] 记录未来实验需要的输入输出格式

### P3-2. 文档更新
- [x] 更新 `README.md`
- [x] 更新 `docs/env-config-guide.md`
- [x] 更新 `docs/prompt-retrieval-relationship.md`
- [x] 更新 `docs/retrieval-scoring-rules.md`
- [x] 更新 `docs/engineering-overview.md`
- [x] 在 `docs` 中补充 MySQL 使用说明（如有必要）

### P3-3. 注释与维护性收尾
- [x] 保持已补充中文注释的文件风格一致
- [x] 新增 V2 代码时同步补充关键中文注释
- [x] 避免逐行翻译式注释

**完成定义**
- [x] 默认规则式召回行为仍可用，不依赖 rerank / embedding
- [x] 文档已覆盖新配置、新流程和新约束
- [x] 核心新增逻辑已有必要中文注释

---

## 全量完成定义（DoD）

- [x] `retrievedContext` 已完成分层
- [x] `draft / review / approve diff` 已使用阶段化上下文视图
- [x] 高风险连续性项能稳定进入约束层
- [x] `DB_CLIENT=mysql` 可正常初始化、迁移、运行 workflow
- [~] SQLite 与 MySQL 下核心链路行为一致
- [x] 默认 SQLite 开发体验不变
- [x] 默认规则式召回行为仍可用，不依赖 rerank / embedding
- [x] 文档已覆盖新配置、新流程和新约束
- [x] 核心新增逻辑已有必要中文注释
