# v3 日志字段说明

## 日志目录

目录解析见 [`src/shared/utils/project-paths.ts`](src/shared/utils/project-paths.ts:78)。

- `logs/operations/`
- `logs/errors/`

## 操作日志结构

类型定义见 [`OperationLog`](src/shared/types/domain.ts:650)。

核心字段：

- `runId`
  - 单次命令执行唯一标识
- `timestamp`
  - 日志时间
- `level`
  - 日志级别
- `command`
  - 命令名，例如 `review chapter`
- `args`
  - 命令参数
- `cwd`
  - 执行目录
- `bookId`
  - 关联书籍 ID
- `chapterId`
  - 关联章节 ID
- `status`
  - `started` / `success` / `error`
- `durationMs`
  - 执行耗时
- `summary`
  - 单行摘要
- `detail`
  - 结构化细节
- `error`
  - 错误对象摘要

## 推荐排障方式

1. 用 [`novel doctor`](src/cli/commands/doctor-commands.ts:15) 确认链路是否断裂
2. 用 [`novel snapshot chapter <chapterId>`](src/cli/commands/snapshot-commands.ts:53) 固定当前快照
3. 在 `logs/operations/` 中按 `chapterId` / `command` / `runId` grep
4. 必要时结合 [`novel state-updates show <chapterId>`](src/cli/commands/state-commands.ts:155) 做状态追溯

## 设计原则

- 主链路命令成功失败都应留痕
- 日志写入失败不应破坏主事务
- 同一类命令输出字段结构应尽量稳定
- 日志既要支持人工阅读，也要支持后续回归脚本读取
