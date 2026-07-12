# Changesets

用 changeset 记录「哪些包、升什么版本、改了什么」，再由 CI 开 Version PR 或发布到 npm。

## 日常

改完准备发版前：

```bash
pnpm changeset
```

按提示选择包与 `patch` / `minor` / `major`，写一句说明。会生成 `.changeset/*.md`，请一并 commit / push。

## 自动发版（OIDC）

推到 `main` 后，`.github/workflows/release.yml` 会：

1. 有未消费的 changeset → 开/更新 **Version Packages** PR（改版本 + CHANGELOG）
2. 合并该 PR → 再次跑 workflow → `changeset publish`（**npm Trusted Publishing / OIDC**，无 `NPM_TOKEN`）

## 首次上 npm

每个 `@mai-kit/*` 包在 npm 设置里添加 Trusted Publisher：

- Workflow filename：`release.yml`（仅文件名）
- Organization / Repository：与本仓库一致

若包尚未创建，可先在本机 `npm publish` 一次占位，或按 npm 文档对首发包配置 Trusted Publisher。
