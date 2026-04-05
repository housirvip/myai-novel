# TESTING_GUIDE

本指南用于约定本项目在 `v6` 之后的测试编写方式、补测触发条件和最小维护标准。

---

## 1. 当前测试体系概览

当前仓库采用：

- `node:test` 作为测试 runner
- `tsx` 作为 TypeScript 运行时加载器
- `tsconfig.test.json` 作为测试代码类型检查入口

常用命令：

```bash
npm test
npm run test:watch
npm run test:coverage
npm run check:test
```

说明：

- `npm test`：执行全部测试
- `npm run test:watch`：本地持续开发时使用
- `npm run test:coverage`：生成覆盖率报告
- `npm run check:test`：对测试代码做类型检查

---

## 2. 目录约定

测试目录按模块语义分层：

```text
tests/
  helpers/
  unit/
    shared/
    infra/
    core/
    cli/
```

### 2.1 `tests/helpers/`

放测试通用辅助能力，例如：

- `env.ts`：临时环境变量切换
- `fs.ts`：临时目录与文件生命周期
- `fetch.ts`：mock 全局 `fetch`
- `process.ts`：临时切换 `cwd`
- `sqlite.ts`：最小 SQLite 数据库与初始数据辅助

### 2.2 `tests/unit/`

按源码模块归属组织：

- `tests/unit/shared/`
- `tests/unit/infra/`
- `tests/unit/core/`
- `tests/unit/cli/`

命名统一使用：

- `*.test.ts`

---

## 3. 什么时候必须补测试

以下改动，默认**必须补测试**：

### 3.1 规则逻辑变更

例如：

- `env` 解析规则
- LLM provider 选择、fallback、timeout / retry 规则
- review / rewrite / planning 中的策略、判定、归一化逻辑
- doctor / regression 中的诊断和结果归类逻辑

### 3.2 基础设施行为变更

例如：

- migration 执行逻辑
- SQLite / MySQL adapter 行为
- repository 读写字段映射
- request runtime 的错误归类和重试逻辑

### 3.3 高风险兼容变更

例如：

- 修改已有 JSON 字段结构
- 修改核心 service 的 fallback 分支
- 修改 CLI 服务层对 provider / backend / stage routing 的展示口径

---

## 4. 什么时候至少补注释

以下改动，至少要补关键注释：

- 新增核心领域对象字段
- 修改 service 职责边界
- 新增 fallback / downgrade / compatibility 分支
- 新增“为什么这样做”的关键判定逻辑

原则不是逐行翻译代码，而是补齐：

- 模块职责
- 输入 / 输出边界
- 副作用
- 分支存在原因

---

## 5. 测试编写优先级

优先级遵循：

1. **纯逻辑 / 稳定 helper**
2. **基础设施路由 / 归类 / normalize**
3. **服务层查询口径与结果结构**
4. **SQLite 最小集成测试**
5. **更重的链路测试**

不建议一开始就优先：

- 全 CLI 快照测试
- 大规模端到端矩阵
- 为了测试而做大规模重构

---

## 6. 编写测试时的建议实践

### 6.1 优先测稳定语义，不绑死实现细节

好测试应优先约束：

- 输入输出关系
- 决策结果
- 结构化返回值
- 错误分类和行为口径

而不是绑定：

- 内部临时变量名
- 实现步骤顺序
- 不重要的字符串拼装细节

### 6.2 纯逻辑优先通过测试入口导出收口

当 service 内部存在稳定纯函数时，可用类似：

- `__reviewServiceTestables`
- `__rewriteServiceTestables`
- `__planningServiceTestables`
- `__generationServiceTestables`

这类测试入口进行收口。

要求：

- 仅暴露稳定纯逻辑
- 不把所有内部细节一股脑导出
- 命名明确表达“测试用途”

### 6.3 对真实存储行为，优先用最小 SQLite 集成测试

当需要验证：

- migration 是否可执行
- repository 字段映射是否正确
- latest / byVersion / list 等查询行为是否稳定

优先使用 `tests/helpers/sqlite.ts` 构造最小 SQLite 测试环境。

---

## 7. Helper 使用约定

### `withEnv()`

用于在测试期间临时切换环境变量，并在结束后自动恢复。

适用场景：

- provider / stage routing 配置测试
- timeout / retry 默认值测试

### `withTempDir()`

用于创建临时目录并在测试完成后清理。

适用场景：

- project path 测试
- 临时输出目录测试

### `withCwd()`

用于临时切换 `process.cwd()`。

适用场景：

- `doctor / regression` 依赖项目根路径时

### `withMockFetch()`

用于替换 `globalThis.fetch`。

适用场景：

- request runtime
- provider adapter

### `withSqliteDatabase()`

用于创建最小 SQLite 数据库、执行迁移并自动关闭连接。

适用场景：

- repository 集成测试
- migration 回归测试

---

## 8. 覆盖率策略

当前阶段：

- 已具备 coverage 输出能力
- 不以全仓高数字作为第一目标
- 优先关注高风险模块是否已有测试保护

建议重点观察目录：

- `src/shared/utils/`
- `src/infra/llm/`
- `src/core/review/`
- `src/core/rewrite/`
- `src/core/planning/`
- `src/core/generation/`
- `src/cli/commands/doctor/`
- `src/cli/commands/regression/`
- `src/infra/db/`
- `src/infra/repository/`

---

## 9. 提交流程建议

如果改动涉及测试覆盖范围内的模块，提交前建议至少执行：

```bash
npm run check:test
npm test
```

如果改动涉及：

- `infra/db`
- `infra/repository`
- `core/review`
- `core/rewrite`
- `infra/llm`

建议额外执行：

```bash
npm run test:coverage
```

---

## 10. 当前 v6 之后的下一步建议

在已有测试基线之上，后续可继续补：

1. 更多 repository 的 SQLite 集成测试
2. `doctor volume / regression volume` 相关测试
3. 更细粒度的 review / approve / chapter workflow 测试
4. 必要时再评估是否引入更强 mocking / snapshot 工具

当前原则仍然是：

> 先把高价值逻辑变成可验证资产，再逐步扩张覆盖面。