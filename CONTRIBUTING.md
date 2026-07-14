# 贡献指南

感谢参与 mai-kit。提交改动前，请先阅读根目录 `AGENTS.md` 和相关包的 `README.md`。

## 开发环境

- Node.js 24；
- Corepack 按根 `packageManager` 使用精确 pnpm 版本；
- 从仓库根目录运行命令。

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
```

## 实现约束

- 所有库包默认同时面向 Node 与浏览器，单端能力必须明确记录；
- 保持 `shared ← utils/database/prober` 等既有依赖方向，不引入反向依赖；
- `tsdown` 独占 `dist`，TypeScript 只运行 `tsc --noEmit`；
- 不为兼容错误 API 增加平行入口、空壳适配或冗余 DTO；
- 公开 API 只从包入口导出，新增公开字段应补充可生成的 API 文档；
- 不提交访问令牌、玩家数据、生成海报或本地环境文件。

## 验证

至少运行与改动相关的单包测试。准备提交 Pull Request 前，建议运行：

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm docs:build
pnpm test:web
```

CI 会在一次构建产物上执行格式、lint、类型检查、单元测试、文档和真实浏览器 smoke。

## Pull Request

- 从独立分支提交，禁止直接推送 `main`；
- 说明改动目的、主要变化和实际执行的验证；
- API、包边界或用户可见行为变化应同步更新 README/指南；
- 需要发布的包行为变化应通过 `pnpm changeset` 添加 changeset；
- 保持改动聚焦，不夹带无关格式化或重构。
