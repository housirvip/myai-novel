# myai-novel

一个面向长篇小说创作流程的 AI CLI 工具，使用 TypeScript、Node.js、SQLite、dotenv，并支持可插拔 LLM provider。

当前 V1 已支持：

- 资源库管理：`book`、`outline`、`world`、`character`、`faction`、`relation`、`item`、`hook`、`chapter`
- 章节工作流：`plan -> draft -> review -> repair -> approve`
- 章节 `plan/draft/final` 的 Markdown 导出与导入
- `mock`、`openai`、`anthropic`、`custom` 四种 LLM provider
- 结构化事实回写、操作日志、LLM 调用耗时日志、可选 AI 输入输出日志

## 1. 环境要求

- Node.js `>= 20`
- npm `>= 10`

## 2. 安装

```bash
npm install
cp .env.example .env
```

## 3. 环境变量

项目使用 `.env` 管理运行配置，完整示例见 [`.env.example`](/Users/housirvip/codex/myai-novel/.env.example)。

最常用的配置如下：

```dotenv
DB_CLIENT=sqlite
DB_SQLITE_PATH=./data/novel.db

LLM_PROVIDER=mock
MOCK_LLM_MODE=echo

LOG_LEVEL=info
LOG_FORMAT=pretty
LOG_LLM_CONTENT_ENABLED=false
```

说明：

- `DB_CLIENT` 当前支持 `sqlite`，已为后续 `mysql` 预留接口
- `LLM_PROVIDER=mock` 适合本地联调和测试
- `LOG_LLM_CONTENT_ENABLED=true` 时会把 AI 输入输出写入日志，默认关闭
- `OPENAI_*`、`ANTHROPIC_*`、`CUSTOM_*` 仅在对应 provider 下需要填写

## 4. 初始化数据库

```bash
npm run dev -- db init
npm run dev -- db check
```

也可以显式执行迁移：

```bash
npm run dev -- db migrate
```

## 5. 快速开始

### 5.1 创建一本书和基础资源

```bash
npm run dev -- book create --title "青岳入门录" --targetChapters 200
npm run dev -- chapter create --book 1 --chapter 1 --title "黑铁令"
npm run dev -- outline create --book 1 --title "入宗篇" --chapterStart 1 --chapterEnd 10 --storyCore "主角带着异常令牌进入宗门"
npm run dev -- world create --book 1 --title "宗门制度" --category "势力规则" --content "外门弟子通过令牌登记入门" --keywords "宗门,外门,令牌"
npm run dev -- character create --book 1 --name "林夜" --background "出身寒门" --keywords "林夜,主角"
npm run dev -- faction create --book 1 --name "青岳宗" --keywords "青岳宗,外门"
npm run dev -- relation create --book 1 --sourceType character --sourceId 1 --targetType faction --targetId 1 --relationType member --keywords "林夜,外门"
npm run dev -- item create --book 1 --name "黑铁令" --ownerType none --keywords "黑铁令,令牌"
npm run dev -- hook create --book 1 --title "黑铁令异常" --hookType mystery --keywords "黑铁令,异常"
```

### 5.2 跑一遍章节工作流

```bash
npm run dev -- plan --book 1 --chapter 1 --provider mock --authorIntent "让林夜带着黑铁令入宗，并引出宗门旧案线索。"
npm run dev -- draft --book 1 --chapter 1 --provider mock
npm run dev -- review --book 1 --chapter 1 --provider mock
npm run dev -- repair --book 1 --chapter 1 --provider mock
npm run dev -- approve --book 1 --chapter 1 --provider mock
```

### 5.3 查看章节与回写后的事实

```bash
npm run dev -- chapter get --book 1 --chapter 1 --json
npm run dev -- relation list --book 1 --json
npm run dev -- hook list --book 1 --json
```

## 6. CLI 示例

### 6.1 资源 CRUD

```bash
npm run dev -- book list --json
npm run dev -- character update --id 1 --status "active" --appendNotes "已正式入宗"
npm run dev -- hook update --id 1 --status progressing
npm run dev -- item delete --id 3
```

### 6.2 `plan` 指定作者意图与召回实体

```bash
npm run dev -- plan \
  --book 1 \
  --chapter 12 \
  --provider mock \
  --authorIntent "本章要让主角借黑铁令撬开外门局势" \
  --characterIds 1,2 \
  --factionIds 1 \
  --relationIds 3 \
  --itemIds 1 \
  --hookIds 1,4 \
  --worldSettingIds 2,5 \
  --json
```

### 6.3 导出并重新导入章节 Markdown

```bash
npm run dev -- chapter export --book 1 --chapter 12 --stage draft --output ./exports/ch12-draft.md
npm run dev -- chapter import --book 1 --chapter 12 --stage draft --input ./exports/ch12-draft.md
```

正式稿默认只允许在章节已 `approved` 后导入；如果需要强制导入：

```bash
npm run dev -- chapter import --book 1 --chapter 12 --stage final --input ./exports/ch12-final.md --force
```

## 7. 日志

日志默认输出到终端，并写入 `LOG_DIR` 指定目录。

建议关注的配置：

- `LOG_LEVEL`：日志级别
- `LOG_FORMAT`：`pretty` 或 `json`
- `LOG_LLM_CONTENT_ENABLED`：是否记录 AI 输入输出正文
- `LOG_LLM_CONTENT_MAX_CHARS`：单次 AI 文本日志最大长度

系统会记录：

- 所有数据表增删改查日志
- `plan/draft/review/repair/approve` 工作流耗时
- LLM 调用的 provider、model、耗时、成功与否

## 8. 测试

```bash
npm run check
npm run build
npm test
```

当前测试覆盖：

- 配置解析
- logger 内容开关
- CLI 参数与关键词校验
- `RelationRepository` CRUD
- LLM factory
- `parseLooseJson`
- mock 工作流全链路
- Markdown 导入导出版本化

## 9. 最小示例数据

仓库提供了一份最小示例脚本：[examples/minimal-seed.sh](/Users/housirvip/codex/myai-novel/examples/minimal-seed.sh)。

它会自动完成：

- 初始化数据库
- 创建一本书和基础设定资源
- 插入一个可直接执行工作流的最小样例

运行方式：

```bash
bash ./examples/minimal-seed.sh
```

如果想写入其他数据库文件，可以临时覆盖环境变量：

```bash
DB_SQLITE_PATH=./data/demo.db bash ./examples/minimal-seed.sh
```

## 10. 项目结构

```text
src/
  cli/                CLI 命令入口
  config/             环境变量配置
  core/db/            DB client、dialect、migration、repository
  core/llm/           LLM 抽象、provider、日志
  core/logger/        日志系统
  domain/             业务 service、planning、workflow
  shared/utils/       公共工具
test/                 单元测试与集成测试
plan/                 V1 方案与 checklist
examples/             示例脚本
```
